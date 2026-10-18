import { describe, expect, it } from "vitest";
import { parseDirections } from "@/lib/openfda";
import { fixtureLabel, type FixtureName } from "./__fixtures__";
import { max24hText } from "./max24h";
import { fieldTexts } from "./sections";

const directions = (name: FixtureName) => {
  const label = fixtureLabel(name);
  return parseDirections({ ...label, dosage_and_administration: fieldTexts(label, "dosage_and_administration") });
};

describe("max24hText — the directions' own daily limit, verbatim", () => {
  it.each<[FixtureName, string]>([
    ["aleve-tablet", "do not exceed 3 tablets in a 24-hour period"],
    ["bayer-genuine-aspirin", "not to exceed 12 tablets in 24 hours"],
    ["bayer-low-dose", "not to exceed 48 tablets in 24 hours"],
    ["childrens-advil-suspension", "do not use more than 4 times a day"],
    ["midol-complete-gelcaps", "do not exceed 6 gelcaps per day"],
    ["zzzquil-liquicaps", "take only one dose (2 LiquiCaps) per day (24 hours)"],
    ["nicorette-fruit-chill-gum", "do not use more than 24 pieces a day"],
    ["nicotine-lozenge-heb", "Do not use more than 20 lozenges per day"],
    ["nyquil-severe-caplet", "do not exceed 8 caplets per 24 hrs"],
    ["childrens-tylenol-suspension", "do not give more than 5 times in 24 hours"],
  ])("%s → %s", (name, expected) => {
    const text = directions(name);
    expect(max24hText(text)).toBe(expected);
    expect(text).toContain(expected); // never computed, always the label's words
  });

  it("reads 'not more than 1 tablet in 24 hours' and 'in any 24-hour period'", () => {
    expect(max24hText("adults: take 1 tablet daily; not more than 1 tablet in 24 hours")).toBe("not more than 1 tablet in 24 hours");
    expect(max24hText("do not take more than 4 doses in any 24-hour period")).toBe("do not take more than 4 doses in any 24-hour period");
  });

  it("ignores limits that aren't per day, and 'more than directed'", () => {
    expect(max24hText("do not take more than directed do not exceed 2 tablets in any 8- to 12-hour period")).toBeNull();
    expect(max24hText("do not use more than 5 lozenges in 6 hours do not use for more than 10 days")).toBeNull();
    expect(max24hText(null)).toBeNull();
  });
});
