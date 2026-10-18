// Every pair of the demo packages (Pepto-Bismol, Tylenol, Midol, Aleve, Benadryl, Motrin and their PM
// versions), compared from their real catalog rows: what "Together" reports, and on which evidence.
import { describe, expect, it } from "vitest";
import demoRows from "./__fixtures__/demo-products.json";
import { compareProducts, type ProductComparison } from "./compare";
import type { Formulation } from "./domain/schema";

/** Real catalog rows (live import, October 2026), copied verbatim. */
const demo = demoRows as unknown as Record<keyof typeof demoRows, Formulation>;
type Key = keyof typeof demo;

/** "shared acetaminophen; nsaid by warning" — or "nothing". */
function summary(c: ProductComparison): string {
  const parts = [...c.shared.map((s) => `shared ${s.normalized}`), ...c.families.map((f) => `${f.familyId} by ${f.evidence.kind}`)];
  return parts.join("; ") || "nothing";
}

const compare = (...keys: Key[]) => compareProducts(keys.map((k) => demo[k]));

/** Every unordered pair. Pairs not listed share nothing and are in no family. */
const PAIRS: Partial<Record<`${Key}+${Key}`, string>> = {
  "tylenolExtraStrength+tylenolPm": "shared acetaminophen",
  "tylenolExtraStrength+midolComplete": "shared acetaminophen",
  "tylenolExtraStrength+midolCompleteGelcaps": "shared acetaminophen",
  "tylenolPm+midolComplete": "shared acetaminophen",
  "tylenolPm+midolCompleteGelcaps": "shared acetaminophen",
  "tylenolPm+alevePm": "shared diphenhydramine",
  "tylenolPm+benadryl": "shared diphenhydramine",
  "tylenolPm+motrinPm": "shared diphenhydramine",
  "midolComplete+midolCompleteGelcaps": "shared acetaminophen; shared caffeine; shared pyrilamine",
  "midolComplete+alevePm": "antihistamine by warning",
  "midolComplete+benadryl": "antihistamine by own_labels",
  "midolComplete+motrinPm": "antihistamine by warning",
  "midolCompleteGelcaps+alevePm": "antihistamine by warning",
  // This Gelcaps row has no Purpose section, so its label never calls pyrilamine an antihistamine.
  "midolCompleteGelcaps+benadryl": "nothing",
  "midolCompleteGelcaps+motrinPm": "antihistamine by warning",
  "aleve+alevePm": "shared naproxen",
  "aleve+motrinIb": "nsaid by warning",
  "aleve+motrinPm": "nsaid by warning",
  "alevePm+benadryl": "shared diphenhydramine",
  "alevePm+motrinIb": "nsaid by warning",
  "alevePm+motrinPm": "shared diphenhydramine; nsaid by warning",
  "benadryl+motrinPm": "shared diphenhydramine",
  "motrinIb+motrinPm": "shared ibuprofen",
};

const keys = Object.keys(demo) as Key[];
const pairs = keys.flatMap((a, i) => keys.slice(i + 1).map((b) => [a, b] as const));

describe("the demo packages, two at a time", () => {
  it("covers all 45 pairs and every listed pair exists", () => {
    expect(pairs).toHaveLength(45);
    const names = new Set(pairs.map(([a, b]) => `${a}+${b}`));
    expect(Object.keys(PAIRS).filter((k) => !names.has(k))).toEqual([]);
  });

  it.each(pairs)("%s + %s", (a, b) => {
    expect(summary(compare(a, b))).toBe(PAIRS[`${a}+${b}`] ?? "nothing");
    // Order doesn't change what is found.
    expect(summary(compare(b, a)).split("; ").sort()).toEqual(summary(compare(a, b)).split("; ").sort());
  });

  it("Tylenol + Midol Complete: acetaminophen, with the label's 'Do not use with any other drug containing' line", () => {
    const c = compare("tylenolExtraStrength", "midolComplete");
    expect(c.shared.map((s) => [s.normalized, s.labelQuote])).toEqual([
      ["acetaminophen", "Do not use with any other drug containing acetaminophen (prescription or nonprescription)."],
    ]);
  });

  it("Tylenol PM + Benadryl: diphenhydramine, quoting the bullet rather than a run-on of several", () => {
    // Benadryl's warningsQuotes runs two "Do not use" bullets together: "Do not use to make a child
    // sleepy with any other product containing diphenhydramine, …".
    for (const other of ["benadryl", "alevePm", "motrinPm"] as const) {
      expect(compare("tylenolPm", other).shared.map((s) => [s.normalized, s.labelQuote])).toEqual([
        ["diphenhydramine", "with any other product containing diphenhydramine, even one used on skin"],
      ]);
    }
  });

  it("Aleve + Motrin IB: both NSAIDs, in Aleve's own warning", () => {
    const c = compare("aleve", "motrinIb");
    expect(c.families).toEqual([
      {
        familyId: "nsaid",
        name: "NSAIDs",
        members: [
          { normalized: "naproxen", displayName: "Naproxen sodium", productId: demo.aleve.id },
          { normalized: "ibuprofen", displayName: "Ibuprofen", productId: demo.motrinIb.id },
        ],
        evidence: { kind: "warning", quote: "take other drugs containing prescription or nonprescription NSAIDs (aspirin, ibuprofen, naproxen, or others)" },
      },
    ]);
  });

  it("Midol Complete + Benadryl: both antihistamines, each in its own Purpose line", () => {
    const c = compare("midolComplete", "benadryl");
    expect(c.shared).toEqual([]);
    expect(c.families[0].evidence).toEqual({
      kind: "own_labels",
      quotes: [
        { product: demo.midolComplete.id, heading: "Purpose", quote: "Antihistamine" },
        { product: demo.benadryl.id, heading: "Purpose", quote: "Antihistamine" },
      ],
    });
  });

  it("Pepto-Bismol shares nothing with any of them: bismuth subsalicylate is in no family", () => {
    for (const k of keys.filter((k) => k !== "peptoBismol")) expect(summary(compare("peptoBismol", k))).toBe("nothing");
  });

  it("never says safe", () => {
    const text = JSON.stringify(pairs.map(([a, b]) => compare(a, b))).toLowerCase();
    expect(text).not.toMatch(/\bsafe/);
  });
});

describe("the demo packages, three or more at a time", () => {
  it("Tylenol + Midol Complete + Motrin IB: acetaminophen only", () => {
    expect(summary(compare("tylenolExtraStrength", "midolComplete", "motrinIb"))).toBe("shared acetaminophen");
  });

  it("Midol Complete + Benadryl + Tylenol PM: two shared ingredients, and Midol's and Benadryl's antihistamines", () => {
    const c = compare("midolComplete", "benadryl", "tylenolPm");
    expect(summary(c)).toBe("shared acetaminophen; shared diphenhydramine; antihistamine by own_labels");
    // Tylenol PM's label calls itself a "Nighttime sleep aid", never an antihistamine.
    expect(c.families[0].members.map((m) => m.productId)).toEqual([demo.midolComplete.id, demo.benadryl.id]);
  });

  it("Aleve + Motrin IB + Pepto-Bismol: the NSAIDs only", () => {
    expect(summary(compare("aleve", "motrinIb", "peptoBismol"))).toBe("nsaid by warning");
  });

  it("all six brands: acetaminophen, the NSAIDs and the antihistamines", () => {
    const c = compare("peptoBismol", "tylenolExtraStrength", "midolComplete", "aleve", "benadryl", "motrinIb");
    expect(summary(c)).toBe("shared acetaminophen; nsaid by warning; antihistamine by own_labels");
    expect(c.shared[0].productIds).toEqual([demo.tylenolExtraStrength.id, demo.midolComplete.id]);
  });
});
