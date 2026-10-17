import { describe, expect, it } from "vitest";
import { FICTIONAL_FORMULATIONS } from "@/data/fictional-formulations";
import { entryFieldsSchema, type EntryFields, type Field, type Formulation } from "@/lib/domain/schema";
import { isFullyReviewed } from "@/lib/domain/fields";
import { buildDemoHousehold, DEMO_CALMORA_SLUG, DEMO_CAREGIVER_NAME, DEMO_TYLENOL_SLUG, hasOwnRecords } from "./household";

const bottleA = FICTIONAL_FORMULATIONS.find((f) => f.slug === DEMO_CALMORA_SLUG)!;
const catalogBottleA: Formulation = { ...bottleA, id: "11111111-1111-4111-8111-111111111111" };
const catalogTylenol: Formulation = {
  id: "22222222-2222-4222-8222-222222222222",
  slug: DEMO_TYLENOL_SLUG,
  brandName: "Tylenol Extra Strength",
  genericName: "Acetaminophen",
  dosageForm: "caplet",
  isFictional: false,
  ndcPackages: ["50580045111"],
  activeIngredients: [
    { name: "Acetaminophen", normalized: "acetaminophen", strength: { amount: 500, unit: "mg", perAmount: 1, perUnit: "caplet" } },
  ],
  directionsText: "take 2 caplets every 6 hours while symptoms last",
  max24hText: "do not take more than 6 caplets in 24 hours, unless directed by a doctor",
  warningsQuotes: [],
  dosageTableHtml: null,
  source: "openfda",
  openfdaSetId: null,
  labelEffectiveDate: null,
};
const catalog = [catalogTylenol, catalogBottleA];

function allFields(fields: EntryFields): Field<unknown>[] {
  return [
    fields.productName,
    fields.dosageForm,
    fields.instructions,
    fields.doseAsWritten,
    fields.max24h,
    ...fields.ingredients.flatMap((i) => [i.name, i.strength] as Field<unknown>[]),
  ];
}

function expectAllConfirmed(fields: EntryFields) {
  expect(entryFieldsSchema.parse(fields)).toEqual(fields);
  expect(isFullyReviewed(fields)).toBe(true);
  for (const f of allFields(fields)) expect(f.state).toBe(f.value === null ? "unknown" : "confirmed");
  expect(fields.productName.state).toBe("confirmed");
  expect(fields.ingredients[0].name.state).toBe("confirmed");
  expect(fields.ingredients[0].strength.state).toBe("confirmed");
}

describe("buildDemoHousehold", () => {
  it("is Alex Rivera with two profiles: Me (Alex) first, then Sam (13, son)", () => {
    const h = buildDemoHousehold(catalog);
    expect(h.caregiverName).toBe("Alex Rivera");
    expect(h.patients.map((p) => [p.displayName, p.relationship])).toEqual([
      ["Alex", "self"],
      ["Sam", "son"],
    ]);
    expect(h.patients[1].notes).toContain("13");
  });

  it("gives Alex one confirmed Tylenol Extra Strength entry from the catalog", () => {
    const [entry, ...rest] = buildDemoHousehold(catalog).patients[0].entries;
    expect(rest).toHaveLength(0);
    expect(entry).toMatchObject({ formulationSlug: DEMO_TYLENOL_SLUG, formulationId: catalogTylenol.id, inputMethod: "picker" });
    expect(entry.fields.productName.value).toBe("Tylenol Extra Strength");
    expect(entry.fields.ingredients[0].strength.value).toEqual({ amount: 500, unit: "mg", perAmount: 1, perUnit: "caplet" });
    expectAllConfirmed(entry.fields);
  });

  it("gives Sam one confirmed Calmora Bottle A entry linked to the catalog row", () => {
    const [entry, ...rest] = buildDemoHousehold(catalog).patients[1].entries;
    expect(rest).toHaveLength(0);
    expect(entry).toMatchObject({ formulationSlug: DEMO_CALMORA_SLUG, formulationId: catalogBottleA.id, documentKind: "otc_package" });
    expect(entry.fields.productName.value).toBe("Calmora Fever Relief (Bottle A)");
    expect(entry.fields.ingredients[0].strength.value).toEqual({ amount: 100, unit: "mg", perAmount: 5, perUnit: "mL" });
    expect(entry.fields.productName.evidence).toEqual({
      kind: "database",
      formulationId: catalogBottleA.id,
      text: "Calmora Fever Relief (Bottle A)",
    });
    expectAllConfirmed(entry.fields);
  });

  it("falls back to inline Tylenol fields when the catalog lacks it", () => {
    const entry = buildDemoHousehold([]).patients[0].entries[0];
    expect(entry.formulationId).toBeNull();
    expect(entry.fields.productName.value).toBe("Tylenol Extra Strength");
    expect(entry.fields.dosageForm.value).toBe("caplet");
    expect(entry.fields.ingredients).toHaveLength(1);
    expect(entry.fields.ingredients[0].name.value).toBe("Acetaminophen");
    expect(entry.fields.ingredients[0].strength.value).toEqual({ amount: 500, unit: "mg", perAmount: 1, perUnit: "caplet" });
    for (const f of allFields(entry.fields)) {
      if (f.value !== null) expect(f.evidence).toEqual({ kind: "quote", text: "Demo record" });
    }
    expectAllConfirmed(entry.fields);
  });

  it("falls back to the fictional Calmora product with no catalog link when the catalog lacks it", () => {
    const entry = buildDemoHousehold([]).patients[1].entries[0];
    expect(entry.formulationId).toBeNull();
    expect(entry.fields.productName.value).toBe("Calmora Fever Relief (Bottle A)");
    // No catalog row to point at, so evidence is the label text itself.
    expect(entry.fields.productName.evidence).toEqual({ kind: "quote", text: "Calmora Fever Relief (Bottle A)" });
    for (const f of allFields(entry.fields)) expect(f.evidence.kind).not.toBe("database");
    expectAllConfirmed(entry.fields);
  });

  it("can leave out the self profile (for someone who already has their own)", () => {
    const h = buildDemoHousehold(catalog, { includeSelf: false });
    expect(h.patients.map((p) => p.displayName)).toEqual(["Sam"]);
  });
});

describe("hasOwnRecords", () => {
  const demo = { isDemo: true };
  const own = { isDemo: false };

  it("is false for a demo-only session, named Alex by the demo or not named at all", () => {
    expect(hasOwnRecords(DEMO_CAREGIVER_NAME, [demo, demo])).toBe(false);
    expect(hasOwnRecords(null, [demo])).toBe(false);
    expect(hasOwnRecords(null, [])).toBe(false);
  });

  it("is true when the user added a profile of their own", () => {
    expect(hasOwnRecords(DEMO_CAREGIVER_NAME, [demo, own])).toBe(true);
  });

  it("is true when the user typed their own name, even before adding anyone", () => {
    expect(hasOwnRecords("Jordan", [demo])).toBe(true);
  });
});
