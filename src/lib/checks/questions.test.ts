import { describe, expect, it } from "vitest";
import {
  databaseQuestion,
  doseQuestion,
  overlapQuestion,
  repeatQuestion,
  strengthQuestion,
  unitsQuestion,
} from "./questions";

describe("pharmacist questions", () => {
  it("uses the fixed strength template", () => {
    expect(
      strengthQuestion([
        { source: "the discharge list", value: "160 mg per 5 mL" },
        { source: "the bottle", value: "100 mg per 5 mL" },
      ]),
    ).toBe(
      "The discharge list says 160 mg per 5 mL but the bottle says 100 mg per 5 mL. Which strength should I be using, and how much?",
    );
  });

  it("lists more than two sources", () => {
    expect(
      strengthQuestion([
        { source: "the prescription label", value: "160 mg per 5 mL" },
        { source: "the discharge list", value: "160 mg per 5 mL" },
        { source: "the bottle", value: "100 mg per 5 mL" },
      ]),
    ).toBe(
      "The prescription label says 160 mg per 5 mL, the discharge list says 160 mg per 5 mL and the bottle says 100 mg per 5 mL. Which strength should I be using, and how much?",
    );
  });

  it("asks about doses without converting them", () => {
    expect(
      doseQuestion([
        { source: "the prescription label", value: "2 tsp" },
        { source: "the discharge list", value: "10 mL" },
      ]),
    ).toBe(
      "The prescription label says 2 tsp but the discharge list says 10 mL. How much should I give, and how should I measure it?",
    );
  });

  it("asks about overlaps, repeats, units and database differences", () => {
    expect(overlapQuestion(["NyQuil", "Calmora A"], "acetaminophen")).toBe(
      "NyQuil and Calmora A both contain acetaminophen. Can they be used together, and what should I watch for?",
    );
    expect(overlapQuestion(["A", "B", "C"], "acetaminophen")).toBe(
      "A, B and C all contain acetaminophen. Can they be used together, and what should I watch for?",
    );
    expect(repeatQuestion("Calmora A", 2)).toBe(
      "Calmora A is in my list 2 times. Is this the same medicine, or are two of the same product being used?",
    );
    expect(unitsQuestion("volume_units", "the prescription label", "2 tsp", "160 mg per 5 mL")).toBe(
      "The prescription label says to give 2 tsp, but the strength is listed as 160 mg per 5 mL. How should I measure this, and with what?",
    );
    expect(databaseQuestion("NyQuil", [{ catalog: "325 mg per caplet", photo: "500 mg per caplet" }])).toBe(
      "The barcode on NyQuil matched a label that says 325 mg per caplet, but the box I have says 500 mg per caplet. Which label matches the product I have?",
    );
  });

  it("never uses the word safe", () => {
    const all = [
      overlapQuestion(["a", "b"], "x"),
      repeatQuestion("a", 2),
      strengthQuestion([
        { source: "a", value: "1" },
        { source: "b", value: "2" },
      ]),
      doseQuestion([
        { source: "a", value: "1" },
        { source: "b", value: "2" },
      ]),
      unitsQuestion("volume_units", "s", "1 tsp", "x"),
      unitsQuestion("mass_dose", "s", "1 mg", "x"),
      unitsQuestion("unclear_unit", "s", "1 dose", "x"),
      databaseQuestion("a", [{ catalog: "x", photo: "y" }]),
    ].join(" ");
    expect(all.toLowerCase()).not.toContain("safe");
  });
});
