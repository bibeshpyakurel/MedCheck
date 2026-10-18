import { describe, expect, it } from "vitest";
import type { CatalogMatch } from "./catalog-match";
import { emptyEntryFields, isFullyReviewed, suggestedField } from "./domain/fields";
import type { EntryFields, Evidence, Formulation, Strength } from "./domain/schema";
import { draftPath, matchChoices, matchOptionLabel, photoNextPath, toMatchOption, typedNameFields, withoutFictional } from "./photo-flow";

const photo: Evidence = { kind: "photo", sourceDocumentId: "doc-1" };
const s500: Strength = { amount: 500, unit: "mg", perAmount: 1, perUnit: "caplet" };

/** What Gemini read: pending suggestions, as extraction leaves them. */
function readFields(read: { productName?: string; ingredient?: string; strength?: Strength }): EntryFields {
  const fields = emptyEntryFields();
  fields.productName = suggestedField(read.productName ?? null, photo);
  fields.ingredients = [{ name: suggestedField(read.ingredient ?? null, photo), strength: suggestedField(read.strength ?? null, photo) }];
  return fields;
}

const readable = readFields({ productName: "TYLENOL Extra Strength", ingredient: "Acetaminophen", strength: s500 });
const blank = readFields({});

describe("photoNextPath (where a photo goes after Gemini reads it)", () => {
  const at = { patientId: "p-1", entryId: "e-1" };

  it("a readable medicine package goes to the one-tap confirm step", () => {
    expect(photoNextPath({ ...at, kind: "otc_package", notice: null, fields: readable })).toBe("/patients/p-1/entries/e-1/match");
  });

  it("a package with only an ingredient read is still readable", () => {
    const fields = readFields({ ingredient: "Ibuprofen" });
    expect(photoNextPath({ ...at, kind: "otc_package", notice: null, fields })).toBe("/patients/p-1/entries/e-1/match");
  });

  it("several medicines in a package photo: the first still goes to confirm", () => {
    expect(photoNextPath({ ...at, kind: "otc_package", notice: "several-found", fields: readable })).toBe(
      "/patients/p-1/entries/e-1/match",
    );
  });

  it("a package with no name and no ingredient read asks for a retake", () => {
    expect(photoNextPath({ ...at, kind: "otc_package", notice: null, fields: blank })).toBe("/patients/p-1/entries/e-1/retake");
    // Only a strength read is not enough to search the catalog.
    const strengthOnly = readFields({ strength: s500 });
    expect(photoNextPath({ ...at, kind: "otc_package", notice: null, fields: strengthOnly })).toBe(
      "/patients/p-1/entries/e-1/retake",
    );
  });

  it("a retake carries why Gemini couldn't read the photo, when it said", () => {
    expect(photoNextPath({ ...at, kind: "otc_package", notice: null, fields: blank, photoIssue: "glare" })).toBe(
      "/patients/p-1/entries/e-1/retake?why=glare",
    );
    expect(photoNextPath({ ...at, kind: "otc_package", notice: "nothing-found", fields: blank, photoIssue: "not_medicine" })).toBe(
      "/patients/p-1/entries/e-1/retake?why=not_medicine",
    );
  });

  it("a readable package goes to confirm even if Gemini noted a photo issue", () => {
    expect(photoNextPath({ ...at, kind: "otc_package", notice: null, fields: readable, photoIssue: "glare" })).toBe(
      "/patients/p-1/entries/e-1/match",
    );
  });

  it("a prescription label with nothing found carries the reason to the review", () => {
    expect(photoNextPath({ ...at, kind: "prescription_label", notice: "nothing-found", fields: blank, photoIssue: "blurry" })).toBe(
      "/patients/p-1/entries/e-1/review?notice=nothing-found&why=blurry",
    );
    // Something was found: the review needs no photo advice.
    expect(photoNextPath({ ...at, kind: "discharge_list", notice: "several-found", fields: readable, photoIssue: "glare" })).toBe(
      "/patients/p-1/entries/e-1/review?notice=several-found",
    );
  });

  it("Gemini failed, isn't set up, or found nothing → retake, whatever the fields say", () => {
    for (const notice of ["ai-failed", "ai-unavailable", "nothing-found"] as const) {
      expect(photoNextPath({ ...at, kind: "otc_package", notice, fields: readable })).toBe("/patients/p-1/entries/e-1/retake");
    }
  });

  it("prescription labels and discharge lists keep the per-field review, notice and all", () => {
    expect(photoNextPath({ ...at, kind: "prescription_label", notice: null, fields: readable })).toBe(
      "/patients/p-1/entries/e-1/review",
    );
    expect(photoNextPath({ ...at, kind: "discharge_list", notice: "several-found", fields: readable })).toBe(
      "/patients/p-1/entries/e-1/review?notice=several-found",
    );
    expect(photoNextPath({ ...at, kind: "prescription_label", notice: "ai-failed", fields: blank })).toBe(
      "/patients/p-1/entries/e-1/review?notice=ai-failed",
    );
  });
});

describe("typedNameFields (Save without a match)", () => {
  it("saves the typed name as the product name; everything else is unknown", () => {
    const fields = typedNameFields(readable, "  Store brand pain relief  ");
    expect(fields.productName).toEqual({
      aiValue: "TYLENOL Extra Strength",
      value: "Store brand pain relief",
      state: "edited",
      evidence: { kind: "quote", text: "Store brand pain relief" },
    });
    for (const f of [fields.dosageForm, fields.instructions, fields.doseAsWritten, fields.max24h]) {
      expect(f.state).toBe("unknown");
      expect(f.value).toBeNull();
    }
    expect(isFullyReviewed(fields)).toBe(true);
  });

  it("keeps the ingredient rows but unknown, so checks needing strength stay unresolved", () => {
    const fields = typedNameFields(readable, "Pain relief");
    expect(fields.ingredients).toHaveLength(1);
    expect(fields.ingredients[0].name).toMatchObject({ aiValue: "Acetaminophen", value: null, state: "unknown" });
    expect(fields.ingredients[0].strength).toMatchObject({ aiValue: s500, value: null, state: "unknown" });
  });

  it("adds one unknown ingredient row when nothing was read", () => {
    const fields = typedNameFields(emptyEntryFields(), "Pain relief");
    expect(fields.ingredients).toEqual([
      { name: { aiValue: null, value: null, state: "unknown", evidence: { kind: "none" } }, strength: { aiValue: null, value: null, state: "unknown", evidence: { kind: "none" } } },
    ]);
  });

  it("a name typed exactly as read counts as confirmed", () => {
    expect(typedNameFields(readable, "TYLENOL Extra Strength").productName.state).toBe("confirmed");
  });

  it("rejects a blank name", () => {
    expect(() => typedNameFields(readable, "   ")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// The picker's options
// ---------------------------------------------------------------------------

function formulation(id: string, brandName: string, strength: Strength, labelerName: string | null = null): Formulation {
  return {
    id,
    slug: id,
    brandName,
    genericName: "Acetaminophen",
    dosageForm: "caplet",
    isFictional: false,
    ndcPackages: [],
    activeIngredients: [{ name: "Acetaminophen", normalized: "acetaminophen", strength }],
    directionsText: null,
    max24hText: null,
    warningsQuotes: [],
    dosageTableHtml: "<table><tr><td>x</td></tr></table>",
    source: "openfda",
    openfdaSetId: id,
    labelEffectiveDate: null,
    labelerName,
    labelSections: { uses: ["temporarily relieves minor aches"] },
    sourceLinks: [],
    reviewed: false,
  };
}
const match = (f: Formulation, strengthAgreement: CatalogMatch["strengthAgreement"], related = true): CatalogMatch => ({
  formulation: f,
  strengthAgreement,
  score: 0,
  related,
});
const s325: Strength = { amount: 325, unit: "mg", perAmount: 1, perUnit: "caplet" };

describe("toMatchOption", () => {
  it("shows brand, each ingredient with its strength, form and labeler — nothing else", () => {
    expect(toMatchOption(formulation("f-es", "Tylenol Extra Strength", s500, "Kenvue"))).toEqual({
      id: "f-es",
      brandName: "Tylenol Extra Strength",
      ingredients: [{ name: "Acetaminophen", strength: "500 mg per caplet" }],
      dosageForm: "caplet",
      labelerName: "Kenvue",
      strengthDiffers: false,
    });
  });
  it("flags a strength that differs from what was read", () => {
    expect(toMatchOption(formulation("f-reg", "Tylenol Regular", s325), "disagrees").strengthDiffers).toBe(true);
  });
});

describe("matchChoices", () => {
  const es = formulation("f-es", "Tylenol Extra Strength", s500);
  const reg = formulation("f-reg", "Tylenol Regular", s325);

  it("pre-selects the best agreeing match and lists it first", () => {
    const choices = matchChoices([match(reg, "disagrees"), match(es, "agrees")]);
    expect(choices.selectedId).toBe("f-es");
    expect(choices.options.map((o) => o.id)).toEqual(["f-es", "f-reg"]);
  });

  it("never pre-selects a disagreeing or unrelated match, but still lists it", () => {
    const choices = matchChoices([match(reg, "disagrees"), match(es, "not_read", false)]);
    expect(choices.selectedId).toBeNull();
    expect(choices.options.map((o) => o.id)).toEqual(["f-reg", "f-es"]);
  });

  it("offers the pre-selected match plus up to 5 others", () => {
    const many = Array.from({ length: 9 }, (_, i) => match(formulation(`f-${i}`, `Brand ${i}`, s500), i === 0 ? "agrees" : "disagrees"));
    const choices = matchChoices(many);
    expect(choices.selectedId).toBe("f-0");
    expect(choices.options).toHaveLength(6);
  });

  it("no matches → nothing to pick", () => {
    expect(matchChoices([])).toEqual({ selectedId: null, options: [] });
  });
});

describe("withoutFictional", () => {
  it("drops fictional demo products (Calmora); real labels keep their order", () => {
    const real1 = formulation("f-es", "Tylenol Extra Strength", s500);
    const real2 = formulation("f-reg", "Tylenol Regular", s325);
    const calmora = { ...formulation("f-calmora", "Calmora Fever Relief (Bottle A)", s500), isFictional: true, source: "fictional" as const };
    expect(withoutFictional([calmora, real1, calmora, real2]).map((f) => f.id)).toEqual(["f-es", "f-reg"]);
  });
});

describe("draftPath (Waiting for your review)", () => {
  const draft = (kind: "otc_package" | "prescription_label" | "discharge_list" | null) => ({
    id: "e-1",
    sourceDocument: kind ? { kind } : null,
  });
  it("a medicine-package draft goes back to its one-tap confirm step", () => {
    expect(draftPath("p-1", draft("otc_package"))).toBe("/patients/p-1/entries/e-1/match");
  });
  it("prescription labels, discharge lists and entries without a photo keep the per-field review", () => {
    expect(draftPath("p-1", draft("prescription_label"))).toBe("/patients/p-1/entries/e-1/review");
    expect(draftPath("p-1", draft("discharge_list"))).toBe("/patients/p-1/entries/e-1/review");
    expect(draftPath("p-1", draft(null))).toBe("/patients/p-1/entries/e-1/review");
  });
});

describe("draftPath fromEntry", () => {
  const draft = (kind: "otc_package" | "prescription_label") => ({ id: "e-1", sourceDocument: { kind } });

  it("a review opened from the medicine's detail page says so, to return there", () => {
    expect(draftPath("p-1", draft("prescription_label"), { fromEntry: true })).toBe("/patients/p-1/entries/e-1/review?from=entry");
  });

  it("a medicine-package draft still goes to the match step", () => {
    expect(draftPath("p-1", draft("otc_package"), { fromEntry: true })).toBe("/patients/p-1/entries/e-1/match");
  });
});

describe("matchOptionLabel (what a screen reader says for a match)", () => {
  it("is the brand name with each ingredient's strength", () => {
    expect(
      matchOptionLabel({
        id: "0b5c1c9e-6b1e-4d7e-9a43-0d6f2b8c1a11",
        brandName: "Tylenol Extra Strength (caplets)",
        ingredients: [{ name: "Acetaminophen", strength: "500 mg per caplet" }],
        dosageForm: "CAPLET",
        labelerName: "Kenvue",
        strengthDiffers: false,
      }),
    ).toBe("Tylenol Extra Strength (caplets), Acetaminophen 500 mg per caplet");
  });

  it("is just the brand name when no ingredient is listed", () => {
    expect(
      matchOptionLabel({ id: "x", brandName: "Calm Tea", ingredients: [], dosageForm: "", labelerName: null, strengthDiffers: false }),
    ).toBe("Calm Tea");
  });
});
