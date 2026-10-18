import { describe, expect, it } from "vitest";
import { FAMILIES, familiesOf } from "./families";
import { normalizeIngredient } from "./ingredients";

const ids = (normalized: string) => familiesOf(normalized).map((f) => f.id);

describe("ingredient families", () => {
  it("lists the five reviewed families", () => {
    expect(FAMILIES.map((f) => f.id)).toEqual(["nsaid", "antihistamine", "nasal_decongestant", "acid_reducer", "sleep_aid"]);
    expect(FAMILIES.map((f) => f.name)).toEqual(["NSAIDs", "antihistamines", "nasal decongestants", "acid reducers", "sleep aids"]);
  });

  it("names members by their normalizeIngredient() output", () => {
    for (const f of FAMILIES) for (const i of f.ingredients) expect(normalizeIngredient(i)).toBe(i);
  });

  it("finds the family of a normalized ingredient", () => {
    expect(ids(normalizeIngredient("Naproxen Sodium"))).toEqual(["nsaid"]);
    expect(ids("ibuprofen")).toEqual(["nsaid"]);
    expect(ids("magnesium salicylate")).toEqual(["nsaid"]);
    expect(ids(normalizeIngredient("Phenylephrine HCl"))).toEqual(["nasal_decongestant"]);
    expect(ids(normalizeIngredient("Esomeprazole magnesium"))).toEqual(["acid_reducer"]);
    expect(ids(normalizeIngredient("Cetirizine Hydrochloride"))).toEqual(["antihistamine"]);
  });

  it("puts diphenhydramine and doxylamine in two families", () => {
    expect(ids("diphenhydramine")).toEqual(["antihistamine", "sleep_aid"]);
    expect(ids("doxylamine")).toEqual(["antihistamine", "sleep_aid"]);
  });

  it("leaves out ingredients that are no family's member", () => {
    expect(ids("acetaminophen")).toEqual([]);
    expect(ids("bismuth subsalicylate")).toEqual([]);
    expect(ids("dextromethorphan")).toEqual([]);
    expect(ids("meclizine")).toEqual([]);
  });

  it("matches how real labels name each family", () => {
    const term = (id: string) => FAMILIES.find((f) => f.id === id)!.labelTerm;
    expect(term("nsaid").test("take other drugs containing prescription or nonprescription NSAIDs [aspirin, ibuprofen, naproxen, or others]")).toBe(true);
    expect(term("nsaid").test("Stomach bleeding warning: This product contains an NSAID, which may cause severe stomach bleeding.")).toBe(true);
    expect(term("antihistamine").test("taking any other antihistamines")).toBe(true);
    expect(term("antihistamine").test("with other drugs that cause drowsiness such as antihistamines and nighttime cold/flu products")).toBe(true);
    expect(term("nasal_decongestant").test("you are taking any other oral nasal decongestant or stimulant.")).toBe(true);
    expect(term("nasal_decongestant").test("taking any other product that contains pseudoephedrine or any other nasal decongestant")).toBe(true);
    expect(term("acid_reducer").test("with other acid reducers")).toBe(true);
    expect(term("sleep_aid").test("you are taking sedatives or tranquilizers, or any other sleep-aid")).toBe(true);
    expect(term("sleep_aid").test("you are taking sedatives or tranquilizers or any other sleep aid")).toBe(true);
  });

  it("does not take a purpose line or an allergy note for a warning about the family", () => {
    const term = (id: string) => FAMILIES.find((f) => f.id === id)!.labelTerm;
    expect(term("antihistamine").test("Antihistamine")).toBe(false);
    expect(term("antihistamine").test("if you have ever had an allergic reaction to this product or any of its ingredients or to an antihistamine containing hydroxyzine.")).toBe(false);
    expect(term("nasal_decongestant").test("Nasal decongestant")).toBe(false);
    expect(term("acid_reducer").test("Acid reducer")).toBe(false);
    expect(term("acid_reducer").test("Acid reducers may interact with certain prescription drugs.")).toBe(false);
    expect(term("sleep_aid").test("Nighttime sleep-aid")).toBe(false);
  });
});
