// NDC Directory dosage forms → the short lowercase values the catalog and the checks use.
// Pure. Unknown forms are not mapped (the label is rejected and counted), never guessed.
//
// `kind` must agree with what `formFamily()` in src/lib/checks/shared.ts infers from the value (tested):
// solids match its SOLID_FORM words or carry a per-unit strength; liquids are "liquid" or per-mL.

export type FormKind = "solid" | "liquid" | "semisolid";

export type FormInfo = {
  form: string;
  kind: FormKind;
  /** The unit a count strength is "per", when it isn't the form itself ("chewing gum" → per "piece"). */
  per?: string;
};

const TABLET: FormInfo = { form: "tablet", kind: "solid" };
const CAPSULE: FormInfo = { form: "capsule", kind: "solid" };
const LIQUID: FormInfo = { form: "liquid", kind: "liquid" };
const POWDER: FormInfo = { form: "powder", kind: "solid" };
const GRANULES: FormInfo = { form: "granules", kind: "solid" };
const ER_TABLET: FormInfo = { form: "extended-release tablet", kind: "solid" };
const ODT: FormInfo = { form: "orally disintegrating tablet", kind: "solid" };

/** Every NDC Directory `dosage_form` seen on oral OTC products, as of 2026-10-17. */
export const NDC_DOSAGE_FORMS: Record<string, FormInfo> = {
  TABLET: TABLET,
  "TABLET, COATED": TABLET,
  "TABLET, FILM COATED": TABLET,
  "TABLET, SUGAR COATED": TABLET,
  "TABLET, MULTILAYER": TABLET,
  "TABLET, SOLUBLE": TABLET,
  PILL: TABLET,
  "TABLET, CHEWABLE": { form: "chewable tablet", kind: "solid" },
  "TABLET, CHEWABLE, EXTENDED RELEASE": { form: "chewable tablet", kind: "solid" },
  "TABLET, EXTENDED RELEASE": ER_TABLET,
  "TABLET, FILM COATED, EXTENDED RELEASE": ER_TABLET,
  "TABLET, MULTILAYER, EXTENDED RELEASE": ER_TABLET,
  "TABLET, DELAYED RELEASE": { form: "delayed-release tablet", kind: "solid" },
  "TABLET, EFFERVESCENT": { form: "effervescent tablet", kind: "solid" },
  "TABLET, ORALLY DISINTEGRATING": ODT,
  "TABLET, ORALLY DISINTEGRATING, DELAYED RELEASE": ODT,
  CAPSULE: CAPSULE,
  "CAPSULE, COATED": CAPSULE,
  "CAPSULE, GELATIN COATED": CAPSULE,
  "CAPSULE, LIQUID FILLED": CAPSULE,
  "CAPSULE, DELAYED RELEASE": { form: "delayed-release capsule", kind: "solid" },
  "CAPSULE, EXTENDED RELEASE": { form: "extended-release capsule", kind: "solid" },
  LOZENGE: { form: "lozenge", kind: "solid" },
  PASTILLE: { form: "lozenge", kind: "solid" },
  TROCHE: { form: "lozenge", kind: "solid" },
  "GUM, CHEWING": { form: "chewing gum", kind: "solid", per: "piece" },
  "BAR, CHEWABLE": { form: "chewable bar", kind: "solid" },
  "CHEWABLE GEL": { form: "chewable gel", kind: "solid" },
  STRIP: { form: "film", kind: "solid" },
  "FILM, SOLUBLE": { form: "film", kind: "solid" },
  POWDER: POWDER,
  "POWDER, FOR SOLUTION": POWDER,
  "POWDER, FOR SUSPENSION": POWDER,
  GRANULE: GRANULES,
  "GRANULE, FOR SOLUTION": GRANULES,
  "GRANULE, EFFERVESCENT": GRANULES,
  CRYSTAL: { form: "crystals", kind: "solid" },
  LIQUID: LIQUID,
  SOLUTION: LIQUID,
  "SOLUTION/ DROPS": LIQUID,
  SUSPENSION: LIQUID,
  "SUSPENSION/ DROPS": LIQUID,
  "SUSPENSION, EXTENDED RELEASE": LIQUID,
  SYRUP: LIQUID,
  ELIXIR: LIQUID,
  EMULSION: LIQUID,
  TINCTURE: LIQUID,
  CONCENTRATE: LIQUID,
  OIL: LIQUID,
  MOUTHWASH: { form: "mouthwash", kind: "liquid" },
  RINSE: { form: "oral rinse", kind: "liquid" },
  SPRAY: { form: "spray", kind: "liquid" },
  "SPRAY, METERED": { form: "spray", kind: "liquid" },
  "AEROSOL, SPRAY": { form: "spray", kind: "liquid" },
  GEL: { form: "gel", kind: "semisolid" },
  "GEL, DENTIFRICE": { form: "toothpaste", kind: "semisolid" },
  "PASTE, DENTIFRICE": { form: "toothpaste", kind: "semisolid" },
  PASTE: { form: "paste", kind: "semisolid" },
  CREAM: { form: "cream", kind: "semisolid" },
  OINTMENT: { form: "ointment", kind: "semisolid" },
};

export function dosageFormFor(ndcForm: string): FormInfo | null {
  return NDC_DOSAGE_FORMS[ndcForm.trim().toUpperCase()] ?? null;
}

/** Label "(in each …)" nouns that may narrow a form within its family, and what they narrow it to. */
const REFINEMENTS: Record<string, Record<string, string>> = {
  tablet: { caplet: "caplet", "gel caplet": "gel caplet", gelcap: "gelcap", "chewable tablet": "chewable tablet", tablet: "tablet" },
  capsule: { softgel: "softgel", gelcap: "gelcap", capsule: "capsule" },
  powder: { packet: "packet", powder: "powder", stick: "packet" },
  granules: { packet: "packet" },
};

/**
 * Narrow the NDC form with the label's own wording ("(in each caplet)" on a TABLET product → caplet).
 * Only when the label names exactly one unit and it belongs to the same family; otherwise the NDC form stands.
 */
export function refineForm(base: FormInfo, labelNouns: string[]): FormInfo {
  const nouns = [...new Set(labelNouns)];
  if (nouns.length !== 1) return base;
  const narrowed = REFINEMENTS[base.form]?.[nouns[0]];
  return narrowed ? { ...base, form: narrowed } : base;
}
