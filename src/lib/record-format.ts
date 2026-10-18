// Display labels and formatting shared by the record page, history and lists. Pure; client-safe.
import type { Formulation, InputMethod, SourceDocumentKind } from "@/lib/domain/schema";

export const DOCUMENT_KIND_LABELS: Record<SourceDocumentKind, string> = {
  otc_package: "Medicine package",
  drug_facts_photo: "Drug Facts label",
  prescription_label: "Prescription label",
  discharge_list: "Discharge list",
  description: "Your description",
};

export const INPUT_METHOD_LABELS: Record<InputMethod, string> = {
  barcode: "Scanned barcode",
  photo: "From a photo",
  voice: "Described aloud",
  typed: "Typed in",
  picker: "Picked from list",
};

/**
 * Where a catalog product's label came from. Fictional products are never called an FDA label,
 * even though they carry an effective date like the real ones.
 */
export function catalogLabelSource(f: Pick<Formulation, "isFictional" | "source" | "labelEffectiveDate">): string {
  if (f.isFictional || f.source !== "openfda") return "Fictional label (not a real product)";
  return `FDA label (openFDA)${f.labelEffectiveDate ? `, effective ${f.labelEffectiveDate}` : ""}`;
}

/** How an entry got linked to a catalog product: "Barcode: NyQuil…" or "Picked from list: Calmora…". */
export function catalogMatchLabel(inputMethod: InputMethod, brandName: string): string {
  const how = inputMethod === "barcode" ? "Barcode" : inputMethod === "picker" ? INPUT_METHOD_LABELS.picker : "Catalog match";
  return `${how}: ${brandName}`;
}

/** The profile for the signed-in person themselves (relationship "self"). */
export function isSelf(p: { relationship: string | null }): boolean {
  return ["self", "myself", "me"].includes(p.relationship?.trim().toLowerCase() ?? "");
}

/** Record heading: "My medicines" or "Sam's medicines". */
export function recordTitle(p: { displayName: string; relationship: string | null }): string {
  return isSelf(p) ? "My medicines" : `${p.displayName}'s medicines`;
}

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** "Oct 16, 2026" for an ISO date (date-only values are read as calendar dates, no time-zone shift). */
export function formatDocDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? iso : dateFormat.format(d);
}

/** The view-transition name a medicine's title shares between the list and its page. */
export function entryTitleTransition(entryId: string): string {
  return `entry-${entryId}-title`;
}
