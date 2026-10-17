// Spoken or typed description → EntryFields. `describeMedicine` calls Gemini; the rest is pure and tested.
import { generateText, Output, type UserContent } from "ai";
import { z } from "zod";
import type { EntryFields, Evidence } from "@/lib/domain/schema";
import { GEMINI_CALL, geminiModel } from "./model";
import { buildEntryFields, unknownEntryFields } from "./raw-fields";

const quote = z
  .string()
  .nullable()
  .describe("The caregiver's exact words this value comes from, copied from the transcript; null if they didn't say it");
const text = (what: string) =>
  z.object({ value: z.string().nullable().describe(`${what}, as the caregiver said it; null if not said`), quote });

const geminiDescriptionSchema = z.object({
  transcript: z.string().describe("Verbatim transcript of what the caregiver said or typed"),
  alreadyGaveBoth: z
    .boolean()
    .describe("True if the caregiver says they already gave or took both medicines, two doses, a double dose, or the same medicine twice"),
  medication: z
    .object({
      productName: text("Medicine name"),
      dosageForm: text("Dosage form, e.g. liquid, caplet, tablet"),
      ingredients: z.array(
        z.object({
          name: text("Active ingredient name"),
          strength: z.object({
            amount: z.number().nullable(),
            unit: z.string().nullable().describe("mg, mcg, g, mL, L, tsp, tbsp or unit"),
            perAmount: z.number().nullable(),
            perUnit: z.string().nullable(),
            quote,
          }),
        }),
      ),
      instructions: text("Directions or how they give it"),
      doseAsWritten: z.object({
        amount: z.number().nullable().describe("The amount they said they give or take"),
        unit: z.string().nullable().describe("Its unit exactly as said, e.g. tsp, mL, caplets"),
        quote,
      }),
      max24h: text("The 24-hour maximum, if they mentioned it"),
    })
    .nullable()
    .describe("The medicine described; null if no medicine was described"),
});

export type GeminiDescription = z.infer<typeof geminiDescriptionSchema>;

export type DescribeResult = { transcript: string; medication: EntryFields | null; alreadyGaveBoth: boolean };

/** What POST /api/describe returns. */
export type DescribeResponse = {
  entryId: string | null;
  transcript: string;
  alreadyGaveBoth: boolean;
  /** Set when AI couldn't read the words, so every field starts unknown. */
  notice: "ai-unavailable" | "ai-failed" | null;
};

const INSTRUCTIONS = `A caregiver is describing a medicine they have at home, in their own words.
Rules:
- Only use what they actually said. Never infer, guess, look up, convert or calculate anything (no dose from age or weight, no strength from the brand name).
- If they did not say a value, return null for it.
- For every value, quote their exact words from the transcript.
- Split a strength into amount, unit, perAmount and perUnit as said ("100 mg per 5 mL" → 100, mg, 5, mL).`;

// ---------------------------------------------------------------------------
// Pure mappers
// ---------------------------------------------------------------------------

const PAST = String.raw`(?:gave|given|took|taken|had|did)`;
const FILLER = String.raw`(?:\s+[\w']+){0,4}?`;
const ALREADY_GAVE_BOTH_PATTERNS = [
  new RegExp(String.raw`\b${PAST}\b${FILLER}\s+(?:both|twice)\b`),
  new RegExp(String.raw`\b${PAST}\b${FILLER}\s+(?:two|2|double)\s+doses?\b`),
  /\bdouble[\s-]?dos(?:e|ed|ing)\b/,
  /\bdoubled[\s-]?up\b/,
];

/** Phrases like "I already gave both", "gave two doses", "took it twice". */
export function detectAlreadyGaveBoth(text: string): boolean {
  const t = text.toLowerCase().replace(/[‘’]/g, "'");
  return ALREADY_GAVE_BOTH_PATTERNS.some((p) => p.test(t));
}

/** Uses the model's quote only when it really is the user's words; otherwise the whole transcript. */
function quoteEvidence(transcript: string) {
  const haystack = transcript.toLowerCase();
  return ({ quote }: { quote: string | null }): Evidence => {
    const q = quote?.trim();
    return { kind: "quote", text: q && haystack.includes(q.toLowerCase()) ? q : transcript };
  };
}

export function toDescribedMedication(
  raw: GeminiDescription,
  transcript: string,
): { medication: EntryFields | null; alreadyGaveBoth: boolean } {
  return {
    medication: raw.medication
      ? buildEntryFields<{ quote: string | null }>(raw.medication, quoteEvidence(transcript))
      : null,
    alreadyGaveBoth: raw.alreadyGaveBoth || detectAlreadyGaveBoth(transcript),
  };
}

/** Manual-entry fallback for a description: everything unknown, the user's words as evidence. */
export function fieldsFromDescription(transcript: string): EntryFields {
  return unknownEntryFields({ kind: "quote", text: transcript });
}

// ---------------------------------------------------------------------------
// Gemini call
// ---------------------------------------------------------------------------

/** Throws on model failure; callers fall back to `fieldsFromDescription` for typed text. */
export async function describeMedicine(input: {
  text?: string;
  audio?: { data: Uint8Array; mediaType: string };
}): Promise<DescribeResult> {
  const typed = input.text?.trim();
  const content: UserContent = [];
  if (input.audio) {
    content.push({ type: "text", text: "Transcribe this recording verbatim, then extract the medicine it describes." });
    content.push({ type: "file", mediaType: input.audio.mediaType, data: input.audio.data });
  } else if (typed) {
    content.push({ type: "text", text: `The caregiver typed:\n"""\n${typed}\n"""` });
  } else {
    throw new Error("Nothing to describe");
  }

  const { output } = await generateText({
    model: geminiModel(),
    ...GEMINI_CALL,
    instructions: INSTRUCTIONS,
    output: Output.object({ schema: geminiDescriptionSchema }),
    messages: [{ role: "user", content }],
  });

  // Typed text is already the user's exact words; only audio needs the model's transcript.
  const transcript = (input.audio ? output.transcript : typed ?? "").trim();
  return { transcript, ...toDescribedMedication(output, transcript) };
}
