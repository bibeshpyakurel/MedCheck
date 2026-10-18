// The OTC photo flow's decisions. Pure; safe on client and server.
// Photo → Gemini reads it → (package) "Is this the medicine?" one-tap confirm, or a retake;
// prescription labels and discharge lists keep the per-field review.
import type { ExtractionNotice } from "@/lib/ai/run-extraction";
import { isReadable, photoReadFromFields, preselectMatch, type CatalogMatch, type StrengthAgreement } from "@/lib/catalog-match";
import { emptyField, formatStrength } from "@/lib/domain/fields";
import type { EntryFields, Field, Formulation, SourceDocumentKind, Strength } from "@/lib/domain/schema";

/** Notices meaning Gemini gave us nothing to match. */
const NOTHING_READ: ReadonlySet<ExtractionNotice> = new Set(["ai-unavailable", "ai-failed", "nothing-found"]);

/**
 * Where to go after a photo was read, for its first draft entry: a medicine package goes to the
 * confirm step (`/match`) when Gemini read a name or an ingredient, otherwise to `/retake`; every
 * other kind of photo goes to the per-field review, with its notice.
 */
export function photoNextPath(input: {
  patientId: string;
  entryId: string;
  kind: SourceDocumentKind;
  notice: ExtractionNotice | null;
  fields: EntryFields;
}): string {
  const base = `/patients/${input.patientId}/entries/${input.entryId}`;
  if (input.kind !== "otc_package") return `${base}/review${input.notice ? `?notice=${input.notice}` : ""}`;
  const readable = !(input.notice && NOTHING_READ.has(input.notice)) && isReadable(photoReadFromFields(input.fields));
  return readable ? `${base}/match` : `${base}/retake`;
}

/**
 * "Save without a match": the typed name is the product name; every other value is `unknown` (what
 * Gemini read stays as `aiValue` for the record), so checks that need a strength stay unresolved.
 */
export function typedNameFields(fields: EntryFields, typedName: string): EntryFields {
  const name = typedName.trim();
  if (!name) throw new Error("A product name is required");
  const unknown = <T>(f: Field<T>): Field<T> => ({ ...f, value: null, state: "unknown" });
  const ingredients = fields.ingredients.length
    ? fields.ingredients.map((i) => ({ name: unknown(i.name), strength: unknown(i.strength) }))
    : [{ name: emptyField<string>(), strength: emptyField<Strength>() }];
  return {
    productName: {
      aiValue: fields.productName.aiValue,
      value: name,
      state: name === fields.productName.aiValue ? "confirmed" : "edited",
      evidence: { kind: "quote", text: name },
    },
    dosageForm: unknown(fields.dosageForm),
    ingredients,
    instructions: unknown(fields.instructions),
    doseAsWritten: unknown(fields.doseAsWritten),
    max24h: unknown(fields.max24h),
  };
}

// ---------------------------------------------------------------------------
// The picker
// ---------------------------------------------------------------------------

/** One catalog label as the picker shows it: enough to tell 325 mg from 500 mg, nothing more. */
export type MatchOption = {
  id: string;
  brandName: string;
  ingredients: { name: string; strength: string }[];
  dosageForm: string;
  labelerName: string | null;
  /** The label's strength disagrees with what Gemini read from the photo. */
  strengthDiffers: boolean;
};

export function toMatchOption(f: Formulation, agreement: StrengthAgreement = "not_read"): MatchOption {
  return {
    id: f.id,
    brandName: f.brandName,
    ingredients: f.activeIngredients.map((i) => ({ name: i.name, strength: formatStrength(i.strength) })),
    dosageForm: f.dosageForm,
    labelerName: f.labelerName,
    strengthDiffers: agreement === "disagrees",
  };
}

const OTHER_MATCHES = 5;

/**
 * "Is this the medicine?": the pre-selected match (best agreeing, related; see `preselectMatch`)
 * first, then up to 5 others in rank order. Nothing is selected when no match qualifies.
 */
export function matchChoices(matches: CatalogMatch[]): { selectedId: string | null; options: MatchOption[] } {
  const selected = preselectMatch(matches);
  const ordered = selected ? [selected, ...matches.filter((m) => m !== selected)] : matches;
  return {
    selectedId: selected?.formulation.id ?? null,
    options: ordered.slice(0, OTHER_MATCHES + 1).map((m) => toMatchOption(m.formulation, m.strengthAgreement)),
  };
}
