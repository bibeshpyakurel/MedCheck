import { describe, expect, it } from "vitest";
import {
  databaseQuestion,
  doseQuestion,
  overlapQuestion,
  repeatQuestion,
  strengthQuestion,
  uniqueSides,
  unitsQuestion,
} from "./questions";

describe("pharmacist questions", () => {
  it("uses the fixed strength template", () => {
    expect(
      strengthQuestion([
        { source: "the discharge list", value: "160 mg per 5 mL" },
        { source: "the package", value: "100 mg per 5 mL" },
      ]),
    ).toBe(
      "The discharge list says 160 mg per 5 mL but the package says 100 mg per 5 mL. Which strength should I be using, and how much?",
    );
  });

  it("lists more than two sources", () => {
    expect(
      strengthQuestion([
        { source: "the prescription label", value: "160 mg per 5 mL" },
        { source: "the discharge list", value: "160 mg per 5 mL" },
        { source: "the package", value: "100 mg per 5 mL" },
      ]),
    ).toBe(
      "The prescription label says 160 mg per 5 mL, the discharge list says 160 mg per 5 mL and the package says 100 mg per 5 mL. Which strength should I be using, and how much?",
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
    expect(
      unitsQuestion("volume_units", { source: "the prescription label", value: "2 tsp" }, { source: "the prescription label", value: "160 mg per 5 mL" }),
    ).toBe(
      "The prescription label says to give 2 tsp, but the strength is listed as 160 mg per 5 mL. How should I measure this, and with what?",
    );
    expect(databaseQuestion("NyQuil", [{ catalog: "325 mg per caplet", photo: "500 mg per caplet" }])).toBe(
      "The barcode on NyQuil matched a label that says 325 mg per caplet, but the box I have says 500 mg per caplet. Which label matches the product I have?",
    );
  });

  it("says when a value was typed by the user rather than read from a label", () => {
    expect(
      strengthQuestion([
        { source: "the discharge list", value: "160 mg per 5 mL" },
        { source: "the package", value: "100 mg per 5 mL", from: "entered" },
      ]),
    ).toBe(
      "The discharge list says 160 mg per 5 mL but I entered 100 mg per 5 mL for the package. Which strength should I be using, and how much?",
    );
    expect(
      doseQuestion([
        { source: "the prescription label", value: "2 tsp", from: "entered" },
        { source: "the discharge list", value: "10 mL", from: "entered" },
      ]),
    ).toBe(
      "I entered 2 tsp for the prescription label but I entered 10 mL for the discharge list. How much should I give, and how should I measure it?",
    );
    expect(
      unitsQuestion(
        "volume_units",
        { source: "the prescription label", value: "2 tsp", from: "entered" },
        { source: "the prescription label", value: "160 mg per 5 mL", from: "entered" },
      ),
    ).toBe(
      "I entered the dose for the prescription label as 2 tsp, but I entered the strength as 160 mg per 5 mL. How should I measure this, and with what?",
    );
    expect(databaseQuestion("NyQuil", [{ catalog: "325 mg per caplet", photo: "500 mg per caplet", photoFrom: "entered" }])).toBe(
      "The barcode on NyQuil matched a label that says 325 mg per caplet, but I entered 500 mg per caplet from the box I have. Which label matches the product I have?",
    );
  });

  it("keeps a typed and a printed copy of the same value apart", () => {
    expect(
      uniqueSides([
        { source: "the package", value: "1" },
        { source: "the package", value: "1", from: "entered" },
        { source: "the package", value: "1" },
      ]),
    ).toHaveLength(2);
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
      unitsQuestion("volume_units", { source: "s", value: "1 tsp" }, { source: "s", value: "x" }),
      unitsQuestion("mass_dose", { source: "s", value: "1 mg" }, { source: "s", value: "x", from: "entered" }),
      unitsQuestion("unclear_unit", { source: "s", value: "1 dose", from: "entered" }, { source: "s", value: "x" }),
      databaseQuestion("a", [{ catalog: "x", photo: "y" }]),
      databaseQuestion("a", [{ catalog: "x", photo: "y", photoFrom: "entered" }]),
      strengthQuestion([
        { source: "a", value: "1", from: "entered" },
        { source: "b", value: "2", from: "entered" },
      ]),
    ].join(" ");
    expect(all.toLowerCase()).not.toContain("safe");
  });
});
