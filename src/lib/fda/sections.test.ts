import { describe, expect, it } from "vitest";
import { LABEL_SECTION_KEYS, labelSectionsSchema, type LabelSectionKey } from "@/lib/domain/schema";
import { allFixtureNames, fixtureLabel } from "./__fixtures__";
import { LABEL_SECTION_FIELDS, labelSections, sectionText, splitSection } from "./sections";

const GLYPH = /[■●•▪◼◆♦►▶✓✔□○‣⁃·∙￭]/u;

describe("labelSections — never reworded", () => {
  it("every bullet is a substring of its section's tidied label text, for every fixture", () => {
    let bullets = 0;
    for (const name of allFixtureNames()) {
      const label = fixtureLabel(name);
      const sections = labelSections(label);
      expect(labelSectionsSchema.safeParse(sections).success).toBe(true);
      for (const [key, list] of Object.entries(sections) as [LabelSectionKey, string[]][]) {
        const text = sectionText(label, key)!;
        expect(text, `${name}.${key}`).toBeTruthy();
        for (const bullet of list) {
          bullets++;
          expect(text.includes(bullet), `${name}.${key}: "${bullet}"`).toBe(true);
          expect(bullet, `${name}.${key}`).not.toMatch(GLYPH);
          expect(bullet.trim()).toBe(bullet);
          expect(bullet.length).toBeGreaterThan(1);
        }
      }
    }
    expect(bullets).toBeGreaterThan(200);
  });

  it("maps every contract key to openFDA label fields", () => {
    expect(Object.keys(LABEL_SECTION_FIELDS).sort()).toEqual([...LABEL_SECTION_KEYS].sort());
  });

  it("only includes the sections a label has", () => {
    const sections = labelSections(fixtureLabel("tylenol-extra-strength-tablet"));
    expect(Object.keys(sections)).not.toContain("when_using"); // this label has no "When using" section
    expect(Object.keys(sections)).toContain("ask_doctor");
  });
});

describe("labelSections — headings and bullets (Tylenol Extra Strength, flattened text)", () => {
  const s = labelSections(fixtureLabel("tylenol-extra-strength-tablet"));

  it("drops the leading heading", () => {
    expect(s.purpose).toEqual(["Pain reliever/fever reducer"]);
    expect(s.ask_doctor).toEqual(["you have liver disease"]);
    expect(s.ask_doctor_or_pharmacist).toEqual(["you are taking the blood thinning drug warfarin"]);
    expect(s.storage?.[0]).toMatch(/^store between 20-25°C/);
    expect(s.inactive_ingredients?.[0]).toMatch(/^carnauba wax, FD&C red no\. 40/);
  });

  it("keeps sentence-only sections whole", () => {
    expect(s.keep_out_of_reach).toEqual(["Keep out of reach of children."]);
    expect(s.pregnancy_or_breast_feeding).toEqual(["If pregnant or breast-feeding, ask a health professional before use."]);
  });

  it("splits uses where a new item starts", () => {
    expect(s.uses).toEqual([
      "temporarily relieves minor aches and pains due to: the common cold headache backache minor pain of arthritis toothache muscular aches premenstrual and menstrual cramps",
      "temporarily reduces fever",
    ]);
  });

  it("leaves out directions that are in the dosing table (the card shows the full table)", () => {
    expect(s.directions).toEqual(["do not take more than directed (see overdose warning )"]);
  });

  it("splits directions by age group and 'do not' lines, keeping each age with its amount", () => {
    const text = sectionText(fixtureLabel("tylenol-extra-strength-tablet"), "directions")!;
    expect(splitSection("directions", text)).toEqual([
      "do not take more than directed (see overdose warning )",
      "adults and children 12 years and over take 2 tablets every 6 hours while symptoms last",
      "do not take more than 6 tablets in 24 hours, unless directed by a doctor",
      "do not use for more than 10 days unless directed by a doctor",
      "children under 12 years ask a doctor",
    ]);
  });

  it("keeps a subheading with its first sentence", () => {
    expect(s.warnings?.[0]).toBe("Liver warning This product contains acetaminophen.");
  });

  it("starts a new item at a sentence end followed by a lowercase item", () => {
    expect(s.do_not_use).toEqual([
      "with any other drug containing acetaminophen (prescription or nonprescription).",
      "If you are not sure whether a drug contains acetaminophen, ask a doctor or pharmacist.",
      "if you are allergic to acetaminophen or any of the inactive ingredients in this product",
    ]);
  });

  it("drops general-warning bullets that repeat a named section", () => {
    expect(s.warnings?.some((b) => b.startsWith("Liver warning"))).toBe(true);
    expect(s.warnings).not.toContain("Ask a doctor before use if you have liver disease");
    expect(s.warnings?.some((b) => b.startsWith("Keep out of reach"))).toBe(false);
  });
});

describe("labelSections — labels that keep their bullet glyphs", () => {
  it("splits on the glyphs (Ibuprofen, stop use)", () => {
    const s = labelSections(fixtureLabel("ibuprofen-with-glyphs"));
    expect(s.stop_use?.slice(0, 5)).toEqual([
      "side effects occur.",
      "You may report side effects to FDA at 1-800-FDA-1088.",
      "you experience any of the following signs of stomach bleeding:",
      "feel faint",
      "vomit blood",
    ]);
    expect(s.directions).toEqual([
      "do not take more than directed",
      "the smallest effective dose should be used",
      "adults and children 12 years and over:",
      "take 1 tablet every 4 to 6 hours while symptoms persist",
      "if pain or fever does not respond to 1 tablet, 2 tablets may be used",
      "do not exceed 6 tablets in 24 hours, unless directed by a doctor",
      "children under 12 years: ask a doctor",
    ]);
  });

  it("splits ask-a-doctor lists on each 'you have' (Advil, flattened)", () => {
    const s = labelSections(fixtureLabel("advil-tablets-caplets-gel-caplets"));
    expect(s.ask_doctor).toEqual([
      "stomach bleeding warning applies to you",
      "you have problems or serious side effects from taking pain relievers or fever reducers",
      "you have a history of stomach problems, such as heartburn",
      "you have high blood pressure, heart disease, liver cirrhosis, kidney disease, asthma, or had a stroke",
      "you are taking a diuretic",
    ]);
  });

  it("leaves the dosing table out of the directions bullets — the card shows the full table (Children's Tylenol)", () => {
    const s = labelSections(fixtureLabel("childrens-tylenol-suspension"));
    expect(s.directions?.[0]).toBe("this product does not contain directions or complete warnings for adult use");
    expect(s.directions).toContain("do not give more than 5 times in 24 hours");
    expect(s.directions?.join(" ")).not.toContain("24-35 lbs");
    expect(s.purpose).toEqual(["Pain reliever/fever reducer"]); // "Purpose Purpose" heading dropped
    expect(s.uses).toContain("reduces fever");
    expect(s.uses).toContain("the common cold"); // "-the common cold" dash bullet
  });
});
