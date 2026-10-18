import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { extractIntoDrafts } from "@/lib/ai/run-extraction";
import { getCurrentUser } from "@/lib/auth";
import { getSourceDocument } from "@/lib/records";

export const maxDuration = 60;

const bodySchema = z.object({
  sourceDocumentId: z.guid(),
});

/**
 * Body `{ sourceDocumentId }`. Runs extraction on the document's photo and creates
 * one draft entry per medication found → `{ entryIds, notice }`. Without Gemini, one blank draft.
 */
export async function POST(request: NextRequest) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Expected { sourceDocumentId }" }, { status: 400 });
  const { sourceDocumentId } = parsed.data;

  const doc = await getSourceDocument(sourceDocumentId);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!doc.photoPath) return NextResponse.json({ error: "Document has no photo" }, { status: 400 });

  const { entryIds, notice } = await extractIntoDrafts(doc);
  return NextResponse.json({ entryIds, notice });
}
