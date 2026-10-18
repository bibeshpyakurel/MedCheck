import { describe, expect, it } from "vitest";
import type { Formulation } from "@/lib/domain/schema";
import labels from "./__fixtures__/quick-answers-labels.json";
import { type QuickAnswer, type QuickAnswerKey, quickAnswers, splitDirectionsByAge } from "./quick-answers";

// Real catalog rows (live import, October 2026), copied verbatim.
const L = labels as unknown as Record<keyof typeof labels, Formulation>;

const answer = (f: Formulation, key: QuickAnswerKey): QuickAnswer | undefined => quickAnswers(f).find((a) => a.key === key);
const must = (f: Formulation, key: QuickAnswerKey): QuickAnswer => {
  const a = answer(f, key);
  if (!a) throw new Error(`no ${key} answer`);
  return a;
};

const ORDER: QuickAnswerKey[] = [
  "uses",
  "whats_in_it",
  "adults",
  "children",
  "max_24h",
  "other_medicines",
  "alcohol",
  "drowsiness",
  "food",
  "pregnancy",
  "who_shouldnt",
  "stop_use",
  "allergies",
  "overdose",
];

/** Every bullet must be a label string (or table cell text) as printed, never ours. */
function labelText(f: Formulation): string {
  const cells = (f.dosageTableHtml ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ");
  return [...Object.values(f.labelSections).flat(), ...f.warningsQuotes, f.directionsText ?? "", f.max24hText ?? "", cells].join("\n");
}

describe("quickAnswers: order and visibility", () => {
  it("keeps the spec's row order; rows 1–6 and 14 are primary, 7–13 sit behind More answers", () => {
    for (const f of Object.values(L)) {
      const answers = quickAnswers(f);
      const keys = answers.map((a) => a.key);
      expect(keys).toEqual(ORDER.filter((k) => keys.includes(k)));
      expect(new Set(keys).size).toBe(keys.length);
      for (const a of answers) {
        const n = ORDER.indexOf(a.key) + 1;
        expect(a.primary, a.key).toBe(n <= 6 || n === 14);
      }
    }
  });

  it("always has Took too much?, last, even when the label prints no overdose line", () => {
    const bare: Formulation = { ...L.advil, labelSections: { uses: ["temporarily relieves minor aches"] }, warningsQuotes: [] };
    const answers = quickAnswers(bare);
    expect(answers.at(-1)).toMatchObject({ key: "overdose", question: "Took too much?", bullets: [] });
  });

  it("leaves out empty rows other than alcohol, drowsiness, food and overdose", () => {
    const bare: Formulation = {
      ...L.advil,
      activeIngredients: [],
      directionsText: null,
      max24hText: null,
      dosageTableHtml: null,
      labelSections: { uses: ["temporarily relieves minor aches"] },
      warningsQuotes: [],
    };
    expect(quickAnswers(bare).map((a) => a.key)).toEqual(["uses", "alcohol", "drowsiness", "food", "overdose"]);
  });

  it("never says safe or fine, and every bullet is the label's own text", () => {
    for (const f of Object.values(L)) {
      const text = labelText(f).replace(/\s+/g, " ");
      for (const a of quickAnswers(f)) {
        expect(`${a.question} ${a.notOnLabel ?? ""}`).not.toMatch(/\b(safe|fine|ok(ay)?)\b/i);
        for (const b of a.bullets) {
          if (a.key === "whats_in_it") continue; // ingredient + strength lines are the card's own formatting
          // Table-derived adult rows join the age cell to its instruction with ": ".
          for (const part of b.split(/: (?=.)/)) expect(text, `${f.brandName} · ${a.key}`).toContain(part.replace(/\s+/g, " ").trim());
        }
      }
    }
  });

  it("puts the dosing table only under Children, whole and untouched", () => {
    for (const f of Object.values(L)) {
      const answers = quickAnswers(f);
      for (const a of answers) if (a.key !== "children") expect(a.dosageTableHtml, a.key).toBeUndefined();
      if (f.dosageTableHtml) expect(must(f, "children").dosageTableHtml).toBe(f.dosageTableHtml);
    }
  });

  it("dedupes repeated bullets within a row (Advil repeats its directions per form)", () => {
    for (const f of Object.values(L))
      for (const a of quickAnswers(f)) {
        const norm = a.bullets.map((b) => b.toLowerCase().replace(/\s+/g, " ").trim());
        expect(new Set(norm).size, `${f.brandName} · ${a.key}`).toBe(norm.length);
      }
    expect(must(L.advil, "children").bullets).toEqual(["children under 12 years: ask a doctor"]);
  });

  it("groups multi-section answers under the label's own headings; bullets are the groups in order", () => {
    for (const f of Object.values(L))
      for (const a of quickAnswers(f)) if (a.groups) expect(a.bullets).toEqual(a.groups.flatMap((g) => g.bullets));
  });
});

describe("quickAnswers: Tylenol Extra Strength (adult tablets, directions in a table)", () => {
  const f = L.tylenolExtraStrength;

  it("What is it for? and What's in it?", () => {
    expect(must(f, "uses")).toMatchObject({ question: "What is it for?", bullets: f.labelSections.uses });
    expect(must(f, "whats_in_it")).toMatchObject({
      question: "What's in it?",
      bullets: ["Acetaminophen 500 mg per tablet", "Pain reliever/fever reducer"],
    });
  });

  it("Adults come from the table's adult row when the directions bullets name no age", () => {
    expect(must(f, "adults")).toMatchObject({
      question: "How much, and how often? — Adults",
      bullets: [
        "do not take more than directed (see overdose warning )",
        "adults and children 12 years and over: take 2 tablets every 6 hours while symptoms last",
        "do not take more than 6 tablets in 24 hours, unless directed by a doctor",
        "do not use for more than 10 days unless directed by a doctor",
      ],
    });
  });

  it("Children is the whole table (it holds the 'children under 12 years: ask a doctor' row)", () => {
    expect(must(f, "children")).toMatchObject({ question: "How much, and how often? — Children", bullets: [], dosageTableHtml: f.dosageTableHtml });
  });

  it("Most in 24 hours is max24hText", () => {
    expect(must(f, "max_24h")).toMatchObject({ question: "Most in 24 hours", bullets: ["do not take more than 6 tablets in 24 hours"] });
  });

  it("Taking other medicines? has the pharmacist line and the liver warning's 'other drugs containing' line in context", () => {
    // Groups follow the Drug Facts order: Warnings, Do not use, Ask a doctor, … , Directions.
    expect(must(f, "other_medicines").groups).toEqual([
      {
        heading: "Warnings",
        bullets: [
          "Liver warning This product contains acetaminophen.",
          "Severe liver damage may occur if you take more than 4,000 mg of acetaminophen in 24 hours",
          "with other drugs containing acetaminophen",
        ],
      },
      {
        heading: "Do not use",
        bullets: ["with any other drug containing acetaminophen (prescription or nonprescription)."],
      },
      {
        heading: "Ask a doctor or pharmacist before use if",
        bullets: ["you are taking the blood thinning drug warfarin"],
      },
    ]);
  });

  it("Alcohol shows the liver warning's alcohol line with its lead-in, not a bare fragment", () => {
    const a = must(f, "alcohol");
    expect(a.question).toBe("Alcohol");
    expect(a.notOnLabel).toBeUndefined();
    expect(a.groups).toEqual([
      {
        heading: "Warnings",
        bullets: [
          "Liver warning This product contains acetaminophen.",
          "Severe liver damage may occur if you take more than 4,000 mg of acetaminophen in 24 hours",
          "3 or more alcoholic drinks every day while using this product",
        ],
      },
    ]);
  });

  it("Drowsiness and food: the label says nothing, so the fixed line, and no bullets", () => {
    expect(must(f, "drowsiness")).toMatchObject({
      question: "Drowsiness and driving",
      bullets: [],
      notOnLabel: "The label doesn't mention drowsiness or driving. Ask a pharmacist.",
    });
    expect(must(f, "food")).toMatchObject({
      question: "With food?",
      bullets: [],
      notOnLabel: "The label doesn't mention food. Ask a pharmacist.",
    });
  });

  it("Who shouldn't take it keeps Do not use apart from Ask a doctor", () => {
    expect(must(f, "who_shouldnt").groups).toEqual([
      { heading: "Do not use", bullets: f.labelSections.do_not_use },
      { heading: "Ask a doctor before use if", bullets: ["you have liver disease"] },
    ]);
  });

  it("Allergies: the allergy alert with its symptoms, the do-not-use allergy line, then the inactive ingredients", () => {
    expect(must(f, "allergies").groups).toEqual([
      {
        heading: "Warnings",
        bullets: [
          "Allergy alert: acetaminophen may cause severe skin reactions.",
          "Symptoms may include: skin reddening blisters rash",
          "If a skin reaction occurs, stop use and seek medical help right away.",
        ],
      },
      { heading: "Do not use", bullets: ["if you are allergic to acetaminophen or any of the inactive ingredients in this product"] },
      { heading: "Inactive ingredients", bullets: f.labelSections.inactive_ingredients },
    ]);
  });

  it("Pregnant, Stop use and Took too much?", () => {
    expect(must(f, "pregnancy")).toMatchObject({ question: "Pregnant or breastfeeding", bullets: f.labelSections.pregnancy_or_breast_feeding });
    expect(must(f, "stop_use")).toMatchObject({ question: "When to stop and call a doctor", bullets: f.labelSections.stop_use });
    expect(must(f, "overdose").bullets).toEqual([
      "Overdose warning In case of overdose, get medical help or contact a Poison Control Center right away. (1-800-222-1222) Quick medical attention is critical for adults as well as for children even if you do not notice any signs or symptoms.",
    ]);
  });
});

describe("quickAnswers: Children's Tylenol (liquid with a weight/age table)", () => {
  const f = L.childrensTylenol;

  it("the general directions stay under a plain 'How much, and how often?' (no adult directions on this label)", () => {
    const a = must(f, "adults");
    expect(a.question).toBe("How much, and how often?");
    expect(a.bullets).toEqual(f.labelSections.directions);
  });

  it("Children holds the full table; no row is pulled out", () => {
    expect(must(f, "children")).toMatchObject({ bullets: [], dosageTableHtml: f.dosageTableHtml });
    for (const a of quickAnswers(f)) if (a.key !== "whats_in_it") for (const b of a.bullets) expect(b).not.toMatch(/\b\d+(\.\d+)? mL\b(?! = )/);
  });

  it("alcohol, drowsiness and food say the label doesn't mention them", () => {
    expect(must(f, "alcohol").notOnLabel).toBe("The label doesn't mention alcohol. Ask a pharmacist.");
    expect(must(f, "drowsiness").notOnLabel).toBeDefined();
    expect(must(f, "food").notOnLabel).toBeDefined();
  });

  it("the overdose line comes from the warnings", () => {
    expect(must(f, "overdose").bullets).toEqual([f.labelSections.warnings!.at(-1)]);
  });
});

describe("quickAnswers: Advil", () => {
  const f = L.advil;

  it("Adults: the label's own adult lines plus the unlabelled ones, once each", () => {
    expect(must(f, "adults").bullets).toEqual([
      "Advil Tablets",
      "do not take more than directed the smallest effective dose should be used",
      "adults and children 12 years and over: take 1 tablet every 4 to 6 hours while symptoms persist if pain or fever does not respond to 1 tablet, 2 tablets may be used",
      "do not exceed 6 tablets in 24 hours, unless directed by a doctor",
      "Advil Caplets",
      "adults and children 12 years and over: take 1 caplet every 4 to 6 hours while symptoms persist if pain or fever does not respond to 1 caplet, 2 caplets may be used",
      "do not exceed 6 caplets in 24 hours, unless directed by a doctor",
      "Advil Gel Caplets",
      "adults and children 12 years and over: take 1 gel caplet every 4 to 6 hours while symptoms persist if pain or fever does not respond to 1 gel caplet, 2 gel caplets may be used",
      "do not exceed 6 gel caplets in 24 hours, unless directed by a doctor",
    ]);
  });

  it("Alcohol: the stomach bleeding warning, its lead-in, then the alcohol line", () => {
    expect(must(f, "alcohol").bullets).toEqual([
      "Stomach bleeding warning: This product contains an NSAID, which may cause severe stomach bleeding.",
      "The chance is higher if you are age 60 or older",
      "have 3 or more alcoholic drinks every day while using this product",
    ]);
  });

  it("With food? quotes When using this product", () => {
    expect(must(f, "food").groups).toEqual([{ heading: "When using this product", bullets: ["take with food or milk if stomach upset occurs"] }]);
  });

  it("Taking other medicines? includes the NSAID 'other drugs containing' line", () => {
    expect(must(f, "other_medicines").bullets).toContain(
      "take other drugs containing prescription or non-prescription NSAIDs [aspirin, ibuprofen, naproxen, or others]",
    );
    expect(must(f, "other_medicines").bullets).toContain("taking any other drug");
  });

  it("Most in 24 hours falls back to nothing new: max24hText is set", () => {
    expect(must(f, "max_24h").bullets).toEqual(["do not exceed 6 tablets in 24 hours"]);
  });

  it("the overdose line comes from Keep out of reach", () => {
    expect(must(f, "overdose").bullets).toEqual(["In case of overdose, get medical help or contact a Poison Control Center right away."]);
  });
});

describe("quickAnswers: antihistamines and acid reducers", () => {
  it("Zyrtec: one when-using bullet answers both alcohol and drowsiness; adults from the table", () => {
    const f = L.zyrtec;
    const line = f.labelSections.when_using![0];
    expect(must(f, "alcohol").bullets).toEqual([line]);
    expect(must(f, "drowsiness").bullets).toEqual([line]);
    expect(must(f, "adults").bullets).toEqual([
      "adults and children 6 years and over: one 10 mg capsule once daily; do not take more than one 10 mg capsule in 24 hours. A 5 mg product may be appropriate for less severe symptoms.",
      "adults 65 years and over: ask a doctor",
    ]);
    expect(must(f, "children").dosageTableHtml).toBe(f.dosageTableHtml);
  });

  it("ZzzQuil: table cells are decoded (&amp;), other diphenhydramine products are flagged", () => {
    const f = L.zzzquil;
    expect(must(f, "adults").bullets).toContain("adults & children 12 yrs & over: 2 LiquiCaps at bedtime if needed or as directed by a doctor");
    expect(must(f, "other_medicines").groups).toEqual([
      { heading: "Do not use", bullets: ["with any other product containing diphenhydramine, even one used on skin"] },
      { heading: "Ask a doctor or pharmacist before use if", bullets: ["you are taking sedatives or tranquilizers"] },
    ]);
    expect(must(f, "alcohol").bullets).toEqual(["avoid alcoholic beverages"]);
  });

  it("Benadryl liquid: 'to make a child sleepy' answers drowsiness under Do not use", () => {
    const f = L.benadrylLiquid;
    expect(must(f, "drowsiness").groups).toEqual([
      { heading: "Do not use", bullets: ["to make a child sleepy"] },
      { heading: "When using this product", bullets: f.labelSections.when_using },
    ]);
    expect(must(f, "adults").bullets[0]).toBe("find right dose on chart below mL = milliliter take every 4 to 6 hours, or as directed by a doctor");
  });

  it("Pepcid AC: adults vs children by the label's own phrases; food from directions only", () => {
    const f = L.pepcidAcMax;
    expect(must(f, "adults").bullets).toEqual([
      "adults and children 12 years and over: to relieve symptoms, swallow 1 tablet with a glass of water.",
      "Do not chew.",
      "to prevent symptoms, swallow 1 tablet with a glass of water at any time from 10 to 60 minutes before eating food or drinking beverages that cause heartburn",
      "do not use more than 2 tablets in 24 hours",
    ]);
    expect(must(f, "children").bullets).toEqual(["children under 12 years: ask a doctor"]);
    expect(must(f, "children").dosageTableHtml).toBeUndefined();
    // "trouble or pain swallowing food" is a symptom, not a food instruction.
    expect(must(f, "food").bullets).toEqual([f.labelSections.directions![2]]);
    expect(must(f, "other_medicines").bullets).toEqual([
      "with other acid reducers",
      "you are taking a prescription drug.",
      "Acid reducers may interact with certain prescription drugs.",
    ]);
    expect(must(f, "allergies").bullets[0]).toBe("Allergy alert Do not use if you are allergic to famotidine or other acid reducers");
  });

  it("Claritin: no directions section — adults and the 24-hour limit come from the table's adult row", () => {
    const f = L.claritin;
    const adult = "adults and children 6 years and over: 1 tablet daily; not more than 1 tablet in 24 hours";
    expect(must(f, "adults")).toMatchObject({ question: "How much, and how often? — Adults", bullets: [adult] });
    expect(must(f, "max_24h").bullets).toEqual([adult]);
    expect(must(f, "drowsiness").bullets).toEqual(["Taking more than directed may cause drowsiness."]);
    expect(answer(f, "other_medicines")).toBeUndefined();
  });
});

describe("quickAnswers: keyword false positives and old rows", () => {
  const base: Formulation = { ...L.advil, dosageTableHtml: null, warningsQuotes: [] };

  it("ignores chemical and product-content uses of 'alcohol', street addresses and uses for drowsiness", () => {
    const f: Formulation = {
      ...base,
      labelSections: {
        uses: ["helps restore mental alertness or wakefulness when experiencing fatigue or drowsiness"],
        inactive_ingredients: ["benzyl alcohol, cetyl alcohol, milk"],
        other_information: ["sugar alcohol content: 1 g mannitol per lozenge", "contains no alcohol"],
        questions: ["Distributed by: CVS Pharmacy, Inc. One CVS Drive"],
        warnings: ["Do not refrigerate, alcohol-free"],
        directions: ["shake well; this is not milk of magnesia"],
      },
    };
    expect(must(f, "alcohol").notOnLabel).toBeDefined();
    expect(must(f, "drowsiness").notOnLabel).toBeDefined();
    expect(must(f, "food").notOnLabel).toBeDefined();
  });

  it("a later Drug Facts heading inside a section starts that section (real misfiled import rows)", () => {
    const f: Formulation = {
      ...base,
      labelSections: {
        // ACETAMINOPHEN (RED), Humanwell PuraCap, 6e617e1e-…
        ask_doctor_or_pharmacist: [
          "the user is taking the blood thinning drug warfarin",
          "Stop use and ask a doctor if pain gets worse or lasts more than 10 days in adults",
          "These could be signs of a serious condition.",
          "If pregnant or breast-feeding , ask a health professional before use.",
          "Keep out of reach of children.",
          "Overdose Warning",
          "In case of overdose, get medical help or contact a Poison Control Center right away. (1-800-222-1222)",
        ],
        // Motion Sickness Relief, Shield, 676b9c4a-…
        stop_use: [
          "When using this product drowsiness may occur n avoid alcoholic beverages alcohol, sedatives, and tranquilizers may increase drowsiness use caution when driving a motor vehicle or operating machinery",
        ],
      },
    };
    expect(must(f, "other_medicines").groups).toEqual([
      { heading: "Ask a doctor or pharmacist before use if", bullets: ["the user is taking the blood thinning drug warfarin"] },
    ]);
    expect(must(f, "stop_use").bullets).toEqual([
      "Stop use and ask a doctor if pain gets worse or lasts more than 10 days in adults",
      "These could be signs of a serious condition.",
    ]);
    expect(must(f, "pregnancy").bullets).toEqual(["If pregnant or breast-feeding , ask a health professional before use."]);
    expect(must(f, "drowsiness").groups).toEqual([{ heading: "When using this product", bullets: f.labelSections.stop_use }]);
    expect(must(f, "overdose").bullets).toEqual([f.labelSections.ask_doctor_or_pharmacist!.at(-1)]);
  });

  it("rows imported before label sections use directionsText and warningsQuotes", () => {
    const f: Formulation = {
      ...base,
      labelSections: {},
      directionsText: "adults and children 12 years and over: take 2 caplets every 6 hours",
      max24hText: null,
      warningsQuotes: [
        "Liver warning: Severe liver damage may occur if you take 3 or more alcoholic drinks every day while using this product.",
        "Do not use with any other drug containing acetaminophen (prescription or nonprescription).",
        "In case of overdose, get medical help or contact a Poison Control Center right away.",
      ],
    };
    expect(must(f, "adults")).toMatchObject({ question: "How much, and how often? — Adults", bullets: [f.directionsText] });
    expect(must(f, "alcohol").bullets).toEqual([f.warningsQuotes[0]]);
    expect(must(f, "other_medicines").bullets).toEqual([f.warningsQuotes[1]]);
    expect(must(f, "overdose").bullets).toEqual([f.warningsQuotes[2]]);
  });
});

describe("splitDirectionsByAge", () => {
  it("sorts bullets by the label's own leading age phrase; everything else is general", () => {
    expect(
      splitDirectionsByAge([
        "shake well before using",
        "adults and children 12 years and over: take 2 tablets every 6 hours",
        "Adults 65 years and over: ask a doctor",
        "a dults and children 12 years and over: 2 tablets",
        "children 6 to under 12 years: take 1 tablet",
        "Children under 2 years: ask a doctor",
        "under 6 years of age: do not use",
        "if you are under 18 years of age, ask a doctor before use",
        "this product does not contain directions or complete warnings for adult use",
        "this adult product is not intended for use in children under 12 years of age",
        "Mix this product (child or adult dose) with at least 8 ounces of water",
      ]),
    ).toEqual({
      general: [
        "shake well before using",
        "this product does not contain directions or complete warnings for adult use",
        "Mix this product (child or adult dose) with at least 8 ounces of water",
      ],
      adults: [
        "adults and children 12 years and over: take 2 tablets every 6 hours",
        "Adults 65 years and over: ask a doctor",
        "a dults and children 12 years and over: 2 tablets",
      ],
      children: [
        "children 6 to under 12 years: take 1 tablet",
        "Children under 2 years: ask a doctor",
        "under 6 years of age: do not use",
        "if you are under 18 years of age, ask a doctor before use",
        "this adult product is not intended for use in children under 12 years of age",
      ],
    });
  });

  it("lines continuing a children's dose stay with it; after 'ask a doctor' they don't (real labels)", () => {
    // Acetaminophen, Cardinal Health 107 (2060a462-…): the children's limit follows the children's dose.
    expect(
      splitDirectionsByAge([
        "do not take more than directed (see overdose warning)",
        "adults and children 12 years and over: take 2 tablets every 4 to 6 hours while symptoms last",
        "do not take more than 10 tablets in 24 hours, unless directed by a doctor",
        "children 6 years to under 12 years o take 1 tablet every 4 to 6 hours while symptoms last",
        "do not take more than 5 tablets in 24 hours",
        "do not use for more than 5 days unless directed by a doctor",
        "children under 6 years: ask a doctor",
      ]),
    ).toEqual({
      general: ["do not take more than directed (see overdose warning)"],
      adults: [
        "adults and children 12 years and over: take 2 tablets every 4 to 6 hours while symptoms last",
        "do not take more than 10 tablets in 24 hours, unless directed by a doctor",
      ],
      children: [
        "children 6 years to under 12 years o take 1 tablet every 4 to 6 hours while symptoms last",
        "do not take more than 5 tablets in 24 hours",
        "do not use for more than 5 days unless directed by a doctor",
        "children under 6 years: ask a doctor",
      ],
    });
    // Acetaminophen and Ibuprofen: the adult limit is printed after "children under 12 years ask a doctor".
    expect(
      splitDirectionsByAge([
        "adults and children 12 years and over take 2 caplets every 8 hours while symptoms persist",
        "children under 12 years ask a doctor",
        "do not take more than 6 caplets in 24 hours, unless directed by a doctor",
      ]).children,
    ).toEqual(["children under 12 years ask a doctor"]);
  });

  it("returns empty groups for no bullets", () => {
    expect(splitDirectionsByAge([])).toEqual({ general: [], adults: [], children: [] });
  });
});
