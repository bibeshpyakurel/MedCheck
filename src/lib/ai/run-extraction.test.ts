import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceDocument } from "@/lib/domain/schema";
import { suggestedField } from "@/lib/domain/fields";
import { unknownEntryFields } from "./raw-fields";
import type { ExtractionResult, PhotoKind } from "./extract-label";

vi.mock("server-only", () => ({}));

const records = vi.hoisted(() => ({
  createDraftEntry: vi.fn(),
  downloadLabelPhoto: vi.fn(),
  updateSourceDocument: vi.fn(),
}));
const gemini = vi.hoisted(() => ({ extractFromPhoto: vi.fn(), hasGeminiKey: vi.fn() }));

vi.mock("@/lib/records", () => records);
vi.mock("./model", () => ({ hasGeminiKey: gemini.hasGeminiKey }));
vi.mock("./extract-label", () => ({ extractFromPhoto: gemini.extractFromPhoto }));

import { extractIntoDrafts } from "./run-extraction";

const doc: SourceDocument = {
  id: "doc-1",
  patientId: "p-1",
  kind: "otc_package",
  photoPath: "u-1/photo.jpg",
  transcriptText: null,
  documentDate: null,
  facility: null,
  prescriber: null,
  pharmacy: null,
  createdAt: "2026-10-17T00:00:00Z",
};

function medicationNamed(name: string) {
  const fields = unknownEntryFields({ kind: "photo", sourceDocumentId: doc.id });
  return { ...fields, productName: suggestedField(name, { kind: "photo", sourceDocumentId: doc.id }) };
}

function geminiReads(documentKind: PhotoKind | null, names: string[] = ["Advil"]): void {
  const result: ExtractionResult = {
    documentKind,
    document: { documentDate: null, facility: null, prescriber: null, pharmacy: null },
    medications: names.map(medicationNamed),
  };
  gemini.extractFromPhoto.mockResolvedValue(result);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  gemini.hasGeminiKey.mockReturnValue(true);
  records.downloadLabelPhoto.mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }));
  let n = 0;
  records.createDraftEntry.mockImplementation(async () => ({ id: `e-${++n}` }));
});

describe("extractIntoDrafts: what kind of photo it was", () => {
  it("asks Gemini without a caller-supplied kind", async () => {
    geminiReads("otc_package");
    await extractIntoDrafts(doc);
    expect(gemini.extractFromPhoto).toHaveBeenCalledWith(expect.any(Uint8Array), "image/jpeg", doc.id);
  });

  it.each(["prescription_label", "discharge_list"] as const)("uses Gemini's kind (%s) and saves it on the document", async (kind) => {
    geminiReads(kind);
    const outcome = await extractIntoDrafts(doc);
    expect(outcome.kind).toBe(kind);
    expect(records.updateSourceDocument).toHaveBeenCalledWith(doc.id, { kind });
  });

  it("a package stays a package; nothing to update", async () => {
    geminiReads("otc_package");
    const outcome = await extractIntoDrafts(doc);
    expect(outcome.kind).toBe("otc_package");
    expect(records.updateSourceDocument).not.toHaveBeenCalled();
  });

  it("an unsure read (null) counts as a package", async () => {
    geminiReads(null);
    expect((await extractIntoDrafts(doc)).kind).toBe("otc_package");
  });

  it("without Gemini, or when the read fails, it's a package", async () => {
    gemini.hasGeminiKey.mockReturnValue(false);
    const unavailable = await extractIntoDrafts(doc);
    expect(unavailable).toMatchObject({ kind: "otc_package", notice: "ai-unavailable" });

    gemini.hasGeminiKey.mockReturnValue(true);
    gemini.extractFromPhoto.mockRejectedValue(new Error("model down"));
    const failed = await extractIntoDrafts(doc);
    expect(failed).toMatchObject({ kind: "otc_package", notice: "ai-failed" });
  });

  it("saves the kind together with the document details it read", async () => {
    gemini.extractFromPhoto.mockResolvedValue({
      documentKind: "discharge_list",
      document: { documentDate: "2026-10-16", facility: "Lakeside Hospital", prescriber: null, pharmacy: null },
      medications: [medicationNamed("Amoxicillin")],
    } satisfies ExtractionResult);
    await extractIntoDrafts(doc);
    expect(records.updateSourceDocument).toHaveBeenCalledWith(doc.id, {
      kind: "discharge_list",
      documentDate: "2026-10-16",
      facility: "Lakeside Hospital",
    });
  });
});

describe("extractIntoDrafts: drafts", () => {
  it("one draft per medication on a package photo, in order", async () => {
    geminiReads("otc_package", ["Advil", "Tylenol Extra Strength"]);
    const outcome = await extractIntoDrafts(doc);
    expect(outcome.entryIds).toEqual(["e-1", "e-2"]);
    expect(outcome.notice).toBe("several-found");
    expect(outcome.firstFields.productName.value).toBe("Advil");
    expect(records.createDraftEntry.mock.calls.map(([d]) => d.fields.productName.value)).toEqual(["Advil", "Tylenol Extra Strength"]);
  });
});
