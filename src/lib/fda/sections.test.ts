import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LABEL_SECTION_KEYS, labelSectionsSchema } from "@/lib/domain/schema";
import { allFixtureNames, fixtureLabel, type FixtureName } from "./__fixtures__";
import { LABEL_SECTION_FIELDS, isPlaceholder, labelSections, labelSourceTexts, sectionText, splitSection } from "./sections";
import { parseSpl, type SplSections } from "./spl";

const GLYPH = /[■●•▪◼◆♦►▶✓✔□○‣⁃·∙￭]/u;
const spl = (file: string): SplSections => parseSpl(readFileSync(path.join(__dirname, "__fixtures__", file), "utf8"));
const SPL: Partial<Record<FixtureName, SplSections>> = {
  "ibuprofen-dye-free-ndc-typo": spl("spl-ibuprofen-dye-free.xml"),
  "tylenol-extra-strength-tablet": spl("spl-tylenol-extra-strength-tablet.xml"),
};
const LEAD_IN = /^(?:(?:if )?(?:you|your child)(?: (?:have|are|has|is|take|get))?|if|symptoms may include:?)$/i;

describe("labelSections — never reworded, never a bare fragment", () => {
  it("every bullet is a substring of the label's tidied section text, for every fixture, with and without SPL", () => {
    let bullets = 0;
    for (const name of allFixtureNames()) {
      const label = fixtureLabel(name);
      const sources = labelSourceTexts(label);
      for (const withSpl of [null, SPL[name] ?? null]) {
        const sections = labelSections(label, { spl: withSpl });
        expect(labelSectionsSchema.safeParse(sections).success).toBe(true);
        for (const [key, list] of Object.entries(sections)) {
          for (const bullet of list) {
            bullets++;
            expect(sources.some((t) => t.includes(bullet)), `${name}.${key}: "${bullet}"`).toBe(true);
            expect(bullet, `${name}.${key}`).not.toMatch(GLYPH);
            expect(bullet.trim()).toBe(bullet);
            expect(bullet, `${name}.${key}: lead-in left alone`).not.toMatch(LEAD_IN);
            expect(bullet, `${name}.${key}: heading left over`).not.toMatch(/^(?:\(s\)|drug|facts|drug facts|purpose|directions\s*\)?)$/i);
          }
        }
      }
    }
    expect(bullets).toBeGreaterThan(400);
  });

  it("maps every contract key to openFDA label fields", () => {
    expect(Object.keys(LABEL_SECTION_FIELDS).sort()).toEqual([...LABEL_SECTION_KEYS].sort());
  });

  it("only includes the sections a label has", () => {
    const sections = labelSections(fixtureLabel("tylenol-extra-strength-tablet"));
    expect(Object.keys(sections)).not.toContain("when_using");
    expect(Object.keys(sections)).toContain("ask_doctor");
  });
});

describe("labelSections — Tylenol Extra Strength (flattened text)", () => {
  const s = labelSections(fixtureLabel("tylenol-extra-strength-tablet"));

  it("drops the leading heading", () => {
    expect(s.purpose).toEqual(["Pain reliever/fever reducer"]);
    expect(s.ask_doctor).toEqual(["you have liver disease"]);
    expect(s.ask_doctor_or_pharmacist).toEqual(["you are taking the blood thinning drug warfarin"]);
    expect(s.inactive_ingredients?.[0]).toMatch(/^carnauba wax, FD&C red no\. 40/);
  });

  it("keeps storage apart from the rest of Other information", () => {
    expect(s.storage).toEqual(["store between 20-25°C (68-77°F)"]);
    expect(s.other_information).toEqual(['do not use if neck band or foil inner seal imprinted with "TYLENOL" is broken or missing']);
  });

  it("keeps sentence-only sections whole", () => {
    expect(s.keep_out_of_reach).toEqual(["Keep out of reach of children."]);
    expect(s.pregnancy_or_breast_feeding).toEqual(["If pregnant or breast-feeding, ask a health professional before use."]);
  });

  it("splits flattened uses at known Drug Facts list items", () => {
    expect(s.uses).toEqual([
      "temporarily relieves minor aches and pains due to: the common cold",
      "headache",
      "backache",
      "minor pain of arthritis",
      "toothache",
      "muscular aches",
      "premenstrual and menstrual cramps",
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

  it("keeps a subheading with its first sentence and splits at sentence ends", () => {
    expect(s.warnings?.[0]).toBe("Liver warning This product contains acetaminophen.");
    expect(s.do_not_use).toEqual([
      "with any other drug containing acetaminophen (prescription or nonprescription).",
      "If you are not sure whether a drug contains acetaminophen, ask a doctor or pharmacist.",
      "if you are allergic to acetaminophen or any of the inactive ingredients in this product",
    ]);
  });

  it("drops general-warning bullets that repeat a named section", () => {
    expect(s.warnings).not.toContain("Ask a doctor before use if you have liver disease");
    expect(s.warnings?.some((b) => b.startsWith("Keep out of reach"))).toBe(false);
  });
});

describe("labelSections — DailyMed SPL list items", () => {
  it("never joins two separate conditions (Ibuprofen Dye-Free: allergy | heart surgery)", () => {
    const label = fixtureLabel("ibuprofen-dye-free-ndc-typo");
    const expected = ["if you have ever had an allergic reaction to any other pain reliever/fever reducer", "right before or after heart surgery"];
    expect(labelSections(label, { spl: SPL["ibuprofen-dye-free-ndc-typo"] }).do_not_use).toEqual(expected);
    // Without the XML, the known monograph boundary still holds.
    expect(labelSections(label).do_not_use).toEqual(expected);
  });

  it("uses the label's own items for flattened lists", () => {
    const s = labelSections(fixtureLabel("tylenol-extra-strength-tablet"), { spl: SPL["tylenol-extra-strength-tablet"] });
    expect(s.stop_use).toEqual([
      "pain gets worse or lasts more than 10 days",
      "fever gets worse or lasts more than 3 days",
      "new symptoms occur",
      "redness or swelling is present",
      "These could be signs of a serious condition.",
    ]);
  });
});

describe("labelSections — lead-ins, glyph labels", () => {
  it("joins a lead-in with the item that follows (Ibuprofen with ■)", () => {
    const s = labelSections(fixtureLabel("ibuprofen-with-glyphs"));
    expect(s.stop_use?.slice(0, 4)).toEqual([
      "side effects occur.",
      "You may report side effects to FDA at 1-800-FDA-1088.",
      "you experience any of the following signs of stomach bleeding: feel faint",
      "vomit blood",
    ]);
    expect(s.directions).toContain("adults and children 12 years and over: take 1 tablet every 4 to 6 hours while symptoms persist");
  });

  it("joins 'Symptoms may include:' and 'if your child takes' with what follows (Children's Tylenol)", () => {
    const s = labelSections(fixtureLabel("childrens-tylenol-suspension"));
    expect(s.warnings).toContain("Symptoms may include: skin reddening");
    expect(s.warnings).toContain("Severe liver damage may occur if your child takes more than 5 doses in 24 hours, which is the maximum daily amount");
    expect(s.directions?.join(" ")).not.toContain("24-35 lbs");
    expect(s.purpose).toEqual(["Pain reliever/fever reducer"]);
  });
});

describe("labelSections — multi-product labels and Questions (Advil tablets/caplets/gel caplets)", () => {
  const s = labelSections(fixtureLabel("advil-tablets-caplets-gel-caplets"));

  it("moves 'Questions or comments?' to its own section", () => {
    expect(s.questions).toEqual(["call toll free 1-800-88-ADVIL"]);
    expect(s.inactive_ingredients?.join(" ")).not.toMatch(/Questions|1-800/);
  });

  it("uses each repeated block once and starts a bullet at each product sub-heading", () => {
    expect(s.inactive_ingredients).toHaveLength(6);
    expect(s.inactive_ingredients?.[0]).toBe("Advil Tablets");
    expect(s.directions).toContain("Advil Caplets");
    expect(s.directions?.some((b) => /ask a doctor Advil/.test(b))).toBe(false);
    expect(s.directions?.filter((b) => b === "Advil Tablets")).toHaveLength(1);
  });
});

describe("labelSections — purpose and heading leftovers", () => {
  it("keeps whole purpose phrases when the purpose shares a table with the ingredients (Tukol)", () => {
    expect(labelSections(fixtureLabel("tukol-syrup-per-ml"), { ingredientNames: ["Acetaminophen", "Dextromethorphan Hydrobromide", "Doxylamine Succinate"] }).purpose).toEqual([
      "Pain reliever/fever reducer",
      "Cough suppressant",
      "Antihistamine",
    ]);
  });

  it("splits a run of purposes (NyQuil)", () => {
    expect(labelSections(fixtureLabel("nyquil-severe-caplet")).purpose).toEqual([
      "Pain reliever/fever reducer",
      "Cough suppressant",
      "Antihistamine",
      "Nasal decongestant",
    ]);
  });

  it.each([
    ["uses", "USE(S) temporarily relieves heartburn", ["temporarily relieves heartburn"]],
    ["storage", "Other lnformation store at room temperature", ["store at room temperature"]],
    ["ask_doctor", "Ask Doctor: if you have liver disease", ["if you have liver disease"]],
    ["pregnancy_or_breast_feeding", "PREGNANCY If pregnant or breast-feeding, ask a health professional before use.", ["If pregnant or breast-feeding, ask a health professional before use."]],
    ["directions", "Directions ) take 1 tablet daily", ["take 1 tablet daily"]],
    ["warnings", "Drug Facts Warnings Allergy alert: may cause hives", ["Allergy alert: may cause hives"]],
  ] as const)("%s: %s", (key, text, expected) => {
    expect(splitSection(key, text)).toEqual(expected);
  });

  it("never cuts inside parentheses", () => {
    expect(splitSection("directions", "adults: take 2 tablets (do not take more than 2 tablets in 24 hours) children under 12 years ask a doctor")).toEqual([
      "adults: take 2 tablets (do not take more than 2 tablets in 24 hours)",
      "children under 12 years ask a doctor",
    ]);
  });
});

describe("isPlaceholder", () => {
  it("flags labels whose sections are only heading words", () => {
    expect(isPlaceholder(fixtureLabel("placeholder-head-and-cold"))).toBe(true);
    expect(isPlaceholder(fixtureLabel("tylenol-extra-strength-tablet"))).toBe(false);
  });
});
