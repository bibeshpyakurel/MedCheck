// Where a finding's evidence came from, for display: whether the user typed it, the entry's label
// view, and the official label for real (openFDA) products. Pure; safe on client and server.
import type { Field, FindingEvidence, Formulation, MedicationEntry } from "@/lib/domain/schema";
import { type Provenance, provenanceOf } from "./shared";

/** The entry field a finding path names ("ingredients[0].strength", "doseAsWritten"); null for catalog paths. */
export function fieldAt(entry: MedicationEntry, path: string): Field<unknown> | null {
  const ing = /^ingredients\[(\d+)\]\.(name|strength)$/.exec(path);
  if (ing) return entry.fields.ingredients[Number(ing[1])]?.[ing[2] as "name" | "strength"] ?? null;
  const { productName, dosageForm, instructions, doseAsWritten, max24h } = entry.fields;
  const top: Record<string, Field<unknown>> = { productName, dosageForm, instructions, doseAsWritten, max24h };
  return top[path] ?? null;
}

/** label / entered / described for one evidence item. Catalog values ("catalog.…" paths) are the label. */
export function evidenceProvenance(e: FindingEvidence, entry: MedicationEntry | undefined): Provenance {
  if (e.documentKind === "description") return "described";
  const field = entry ? fieldAt(entry, e.field) : null;
  if (entry && field) return provenanceOf(entry, field);
  return e.evidence.kind === "quote" && !e.documentKind ? "described" : "label";
}

/** The entry's label view: confirmed values beside the label, the photo, warnings and dosing table. */
export function entrySourceHref(patientId: string, entryId: string): string {
  return `/patients/${patientId}/entries/${entryId}`;
}

/** The official FDA label on DailyMed, for openFDA catalog products only — never for fictional ones. */
export function officialLabelUrl(f: Formulation | null | undefined): string | null {
  if (!f || f.isFictional || f.source !== "openfda" || !f.openfdaSetId) return null;
  return `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${encodeURIComponent(f.openfdaSetId)}`;
}
