// The OTC photo flow's decisions. Pure; safe on client and server.
// Photo → Gemini reads it → (package) "Is this the medicine?" one-tap confirm, or a retake;
// prescription labels and discharge lists keep the per-field review.
import type { ExtractionNotice } from "@/lib/ai/run-extraction";
import { isReadable, photoReadFromFields, preselectMatch, type CatalogMatch, type StrengthAgreement } from "@/lib/catalog-match";
import { emptyField, formatStrength } from "@/lib/domain/fields";
import { distinctMatches } from "@/lib/match-groups";
import type { EntryFields, Field, Formulation, SourceDocumentKind, Strength } from "@/lib/domain/schema";
import type { PhotoIssue } from "@/lib/photo-issue";

/**
 * A photo that was read: the page to go to next, one draft per medicine found (in order), what
 * Gemini said the photo shows (the source document's kind), and that document.
 */
export type PhotoReadResult = { next: string; entryIds: string[]; kind: SourceDocumentKind; sourceDocumentId: string };

/** Notices meaning Gemini gave us nothing to match. */
const NOTHING_READ: ReadonlySet<ExtractionNotice> = new Set(["ai-unavailable", "ai-failed", "nothing-found"]);

/**
 * Where to go after a photo was read, for its first draft entry: a medicine package goes to the
 * confirm step (`/match`) when Gemini read a name or an ingredient or its printed code matched a
 * catalog label, otherwise to `/retake`; every other kind of photo goes to the per-field review, with
 * its notice. A retake, or a review with nothing found, carries Gemini's `photoIssue` as `?why=` so
 * the page can say what to change.
 */
export function photoNextPath(input: {
  patientId: string;
  entryId: string;
  kind: SourceDocumentKind;
  notice: ExtractionNotice | null;
  fields: EntryFields;
  photoIssue?: PhotoIssue | null;
  /** The package's printed NDC or barcode matched a catalog label: there is something to confirm. */
  codeMatched?: boolean;
}): string {
  const base = `/patients/${input.patientId}/entries/${input.entryId}`;
  const why = input.photoIssue ? `why=${input.photoIssue}` : null;
  if (input.kind !== "otc_package") {
    const params = [input.notice && `notice=${input.notice}`, input.notice === "nothing-found" && why].filter(Boolean);
    return `${base}/review${params.length ? `?${params.join("&")}` : ""}`;
  }
  const readable =
    !(input.notice && NOTHING_READ.has(input.notice)) && (input.codeMatched || isReadable(photoReadFromFields(input.fields)));
  return readable ? `${base}/match` : `${base}/retake${why ? `?${why}` : ""}`;
}

/**
 * A draft's "Check details" link: a medicine-package draft returns to `/match`, anything else to
 * `/review` (`fromEntry`: opened from the medicine's detail page, which the review then returns to).
 */
export function draftPath(
  patientId: string,
  entry: { id: string; sourceDocument: { kind: SourceDocumentKind } | null },
  { fromEntry = false } = {},
): string {
  const base = `/patients/${patientId}/entries/${entry.id}`;
  if (entry.sourceDocument?.kind === "otc_package") return `${base}/match`;
  return `${base}/review${fromEntry ? "?from=entry" : ""}`;
}

/** Fictional demo products (Calmora) are no longer part of the product; never offer them. */
export function withoutFictional<T extends Pick<Formulation, "isFictional">>(formulations: T[]): T[] {
  return formulations.filter((f) => !f.isFictional);
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
  /** The NDC or barcode printed on the package belongs to this label. */
  matchedByCode: boolean;
};

export function toMatchOption(f: Formulation, agreement: StrengthAgreement = "not_read", matchedByCode = false): MatchOption {
  return {
    id: f.id,
    brandName: f.brandName,
    ingredients: f.activeIngredients.map((i) => ({ name: i.name, strength: formatStrength(i.strength) })),
    dosageForm: f.dosageForm,
    labelerName: f.labelerName,
    strengthDiffers: agreement === "disagrees",
    matchedByCode,
  };
}

/** A match's accessible name: "Tylenol Extra Strength (caplets), Acetaminophen 500 mg per caplet". */
export function matchOptionLabel(option: MatchOption): string {
  return [option.brandName, ...option.ingredients.map((i) => `${i.name} ${i.strength}`)].join(", ");
}

export const OTHER_MATCHES = 5;

/**
 * "Is this the medicine?": the pre-selected match first, then up to 5 others in rank order — one per
 * distinct product (`distinctMatches`). A `codeMatch` (the label the package's printed NDC or barcode
 * points to; see `trustedCodeMatch`) is the pre-selected one and stands for its product; otherwise the
 * best agreeing, related match (`preselectMatch`). Nothing is selected when no match qualifies.
 */
export function matchChoices(
  matches: CatalogMatch[],
  codeMatch: CatalogMatch | null = null,
): { selectedId: string | null; options: MatchOption[] } {
  const others = codeMatch ? matches.filter((m) => m.formulation.id !== codeMatch.formulation.id) : matches;
  const distinct = distinctMatches(codeMatch ? [codeMatch, ...others] : others);
  const rest = codeMatch ? distinct.slice(1) : distinct;
  const selected = codeMatch ?? preselectMatch(rest);
  const ordered = selected ? [selected, ...rest.filter((m) => m !== selected)] : rest;
  return {
    selectedId: selected?.formulation.id ?? null,
    options: ordered
      .slice(0, OTHER_MATCHES + 1)
      .map((m) => toMatchOption(m.formulation, m.strengthAgreement, m === codeMatch)),
  };
}
