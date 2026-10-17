import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  describeMedicine,
  detectAlreadyGaveBoth,
  fieldsFromDescription,
  type DescribeFailure,
  type DescribeResponse,
  type DescribeResult,
} from "@/lib/ai/describe";
import { hasGeminiKey } from "@/lib/ai/model";
import { getCurrentUser } from "@/lib/auth";
import { createDraftEntry, createSourceDocument, getPatient } from "@/lib/records";

export const maxDuration = 60;

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_CHARS = 4000;

/**
 * multipart/form-data: `patientId`, and `text` (typed) or `audio` (a recording); `manual=1` skips AI.
 * Creates a `description` source document and one draft entry, and reports "already gave both".
 * If Gemini fails, nothing is saved and it answers 503 `{ error, retry: true }` so the user can try
 * again or choose manual entry — unless the words already say "I already gave both".
 */
export async function POST(request: NextRequest) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const patientId = form?.get("patientId");
  if (typeof patientId !== "string" || !z.guid().safeParse(patientId).success || !(await getPatient(patientId))) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }
  const textValue = form?.get("text");
  const text = typeof textValue === "string" ? textValue.trim().slice(0, MAX_TEXT_CHARS) : "";
  const audioValue = form?.get("audio");
  const audio = audioValue instanceof File && audioValue.size > 0 ? audioValue : null;
  if (!text && !audio) return NextResponse.json({ error: "Say or type something first." }, { status: 400 });
  if (audio && audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "That recording is too long. Try a shorter one, or type it." }, { status: 413 });
  }

  const manual = form?.get("manual") === "1" && !audio;

  let result: DescribeResult | null = null;
  let notice: DescribeResponse["notice"] = null;
  if (manual) {
    // The user chose to type the values after automatic reading failed.
    notice = "ai-failed";
  } else if (!hasGeminiKey()) {
    notice = "ai-unavailable";
  } else {
    try {
      result = audio
        ? await describeMedicine({
            audio: { data: new Uint8Array(await audio.arrayBuffer()), mediaType: audio.type.split(";")[0] || "audio/webm" },
          })
        : await describeMedicine({ text });
    } catch (error) {
      console.error("Gemini describe failed", error);
      // "I already gave both" must still reach the fixed message; anything else lets the user retry.
      if (audio || !detectAlreadyGaveBoth(text)) {
        const failure: DescribeFailure = {
          error: audio
            ? "We couldn't listen to the recording just now. Try again, or type the description instead."
            : "We couldn't read your description automatically just now. Your words are still here — try again, or enter the details yourself.",
          retry: true,
        };
        return NextResponse.json(failure, { status: 503 });
      }
      notice = "ai-failed";
    }
  }

  if (!result) {
    // Without AI a recording can't be read; typed words still become a draft the user fills in.
    if (audio) {
      return NextResponse.json(
        { error: "We couldn't listen to the recording right now. Please type the description instead." },
        { status: 503 },
      );
    }
    result = { transcript: text, medication: null, alreadyGaveBoth: detectAlreadyGaveBoth(text) };
  }

  const transcript = result.transcript || text;
  let entryId: string | null = null;
  // "I already gave both" with no medicine named needs only the fixed message, not a record.
  if (result.medication || !result.alreadyGaveBoth) {
    const doc = await createSourceDocument({ patientId, kind: "description", transcriptText: transcript });
    const entry = await createDraftEntry({
      patientId,
      sourceDocumentId: doc.id,
      formulationId: null,
      inputMethod: audio ? "voice" : "typed",
      fields: result.medication ?? fieldsFromDescription(transcript),
    });
    entryId = entry.id;
  }

  const body: DescribeResponse = { entryId, transcript, alreadyGaveBoth: result.alreadyGaveBoth, notice };
  return NextResponse.json(body);
}
