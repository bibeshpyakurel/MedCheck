import { describe, expect, it } from "vitest";
import { tidy } from "@/lib/openfda";
import { fixtureLabel, type FixtureName } from "./__fixtures__";
import { findPrinted, strengthIsTraceable } from "./label-strength";

const active = (name: FixtureName) => tidy((fixtureLabel(name).active_ingredient ?? []).join(" "));

describe("findPrinted — the amount the label prints for an ingredient", () => {
  it("reads name + amount from the Active ingredient text", () => {
    expect(findPrinted(active("tukol-syrup-per-ml"), "DEXTROMETHORPHAN HYDROBROMIDE", ["ACETAMINOPHEN", "DOXYLAMINE SUCCINATE"])).toMatchObject({
      amount: 20,
      unit: "mg",
    });
    expect(findPrinted(active("tukol-syrup-per-ml"), "ACETAMINOPHEN", [])).toMatchObject({ amount: 650, unit: "mg" });
  });

  it("reads 'X equal to 200 mg ibuprofen'", () => {
    expect(findPrinted(active("ibuprofen-dye-free-ndc-typo"), "IBUPROFEN", [])).toMatchObject({ amount: 200, unit: "mg" });
  });

  it("uses the leading (base) name and amount for 'X 75 mg (as SALT 84 mg)'", () => {
    expect(findPrinted(active("ranitidine-as-salt"), "RANITIDINE HYDROCHLORIDE", [])).toMatchObject({
      amount: 75,
      unit: "mg",
      baseName: "Ranitidine",
    });
  });

  it("reads percents and whether the label states w/v or w/w", () => {
    expect(findPrinted(active("fluoride-rinse-ion-basis"), "SODIUM FLUORIDE", [])).toMatchObject({ amount: 0.05, unit: "%", basis: null });
    expect(findPrinted(active("listerine-toothpaste-smfp"), "SODIUM MONOFLUOROPHOSPHATE", [])).toMatchObject({ amount: 0.76, unit: "%", basis: null });
    expect(findPrinted("Active ingredient Sodium fluoride 0.05% w/v", "SODIUM FLUORIDE", [])).toMatchObject({ amount: 0.05, unit: "%", basis: "w/v" });
  });

  it("reads the metric amount after an apothecary one, and 'X (equal to 4 mg Y)'", () => {
    expect(findPrinted("Active Ingredient (in each tablet) Calcium Carbonate 10 gr (648 mg)", "CALCIUM CARBONATE", [])).toMatchObject({ amount: 648, unit: "mg" });
    expect(findPrinted("Active ingredient (in each chewing piece) Nicotine polacrilex (equal to 4 mg nicotine)", "NICOTINE", [])).toMatchObject({
      amount: 4,
      unit: "mg",
    });
  });

  it("reads spelled-out units and a parenthesized basis", () => {
    expect(findPrinted("Active ingredient (in each dose) Polyethylene Glycol 3350, USP 17 grams (cup filled to the line)", "POLYETHYLENE GLYCOL 3350", [])).toMatchObject({
      amount: 17,
      unit: "g",
    });
    expect(findPrinted("Active Ingredient Benzocaine 20.0% (w/w)", "BENZOCAINE", [])).toMatchObject({ amount: 20, unit: "%", basis: "w/w" });
  });

  it("finds nothing when the label prints no amount", () => {
    expect(findPrinted(active("jba-omelia-no-active-section"), "LEPIDIUM MEYENII ROOT", [])).toBeNull();
    expect(findPrinted(active("placeholder-head-and-cold"), "ACETAMINOPHEN", [])).toBeNull();
  });

  it("doesn't take another ingredient's amount when names share a first word", () => {
    const text = "Active ingredients (in each tablet) Sodium bicarbonate 1916 mg Citric acid 1000 mg";
    expect(findPrinted(text, "SODIUM CITRATE", ["SODIUM BICARBONATE", "CITRIC ACID"])).toBeNull();
    expect(findPrinted(text, "SODIUM BICARBONATE", ["SODIUM CITRATE", "CITRIC ACID"])).toMatchObject({ amount: 1916 });
  });
});

describe("strengthIsTraceable — whole-run check of a stored strength against the label", () => {
  const ing = (name: string, amount: number, unit: "mg" | "g", perAmount: number, perUnit: string) => ({
    name,
    normalized: name.toLowerCase(),
    strength: { amount, unit, perAmount, perUnit },
  });

  it("is true only when the ingredient's own printed amount and per-volume match", () => {
    const text = active("tukol-syrup-per-ml");
    expect(strengthIsTraceable(ing("Acetaminophen", 650, "mg", 30, "mL"), [], text)).toBe(true);
    expect(strengthIsTraceable(ing("Acetaminophen", 21.67, "mg", 1, "mL"), [], text)).toBe(false);
    expect(strengthIsTraceable(ing("Acetaminophen", 650, "mg", 1, "mL"), [], text)).toBe(false);
  });

  it("accepts a percent restated as mg per mL, but not another number from the line (the fluoride ion)", () => {
    expect(strengthIsTraceable(ing("Sodium Fluoride", 0.5, "mg", 1, "mL"), [], "Sodium fluoride 0.05% w/v")).toBe(true);
    expect(strengthIsTraceable(ing("Sodium Fluoride", 0.2, "mg", 1, "mL"), [], active("fluoride-rinse-ion-basis"))).toBe(false);
  });

  it("is false when the label prints no amount", () => {
    expect(strengthIsTraceable(ing("Lepidium Meyenii Root", 120, "mg", 1, "capsule"), [], active("jba-omelia-no-active-section"))).toBe(false);
  });
});
