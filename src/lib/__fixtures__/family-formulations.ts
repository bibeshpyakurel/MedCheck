// Catalog rows for the comparison and family tests. Ingredients and warning bullets are copied from
// real FDA labels in the catalog (Haleon, Kenvue, Bayer, P&G); everything else is trimmed.
import type { CatalogIngredient, Formulation, LabelSections, Strength } from "@/lib/domain/schema";

const mg = (amount: number, perUnit: string): Strength => ({ amount, unit: "mg", perAmount: 1, perUnit });
const ing = (name: string, normalized: string, strength: Strength): CatalogIngredient => ({ name, normalized, strength });

function formulation(id: string, brandName: string, activeIngredients: CatalogIngredient[], labelSections: LabelSections, warningsQuotes: string[] = []): Formulation {
  return {
    id,
    slug: id,
    brandName,
    genericName: activeIngredients.map((i) => i.name).join(", "),
    dosageForm: "tablet",
    isFictional: false,
    ndcPackages: [],
    activeIngredients,
    directionsText: null,
    max24hText: null,
    warningsQuotes,
    dosageTableHtml: null,
    source: "openfda",
    openfdaSetId: null,
    labelEffectiveDate: null,
    labelerName: null,
    labelSections,
    sourceLinks: [],
    reviewed: false,
  };
}

export const NSAID_OTHER_DRUGS = "take other drugs containing prescription or non-prescription NSAIDs [aspirin, ibuprofen, naproxen, or others]";
export const NSAID_STOMACH = "Stomach bleeding warning: This product contains an NSAID, which may cause severe stomach bleeding.";
export const ACETAMINOPHEN_DO_NOT_USE = "Do not use with any other drug containing acetaminophen (prescription or nonprescription).";

export const advil = formulation(
  "f-advil",
  "Advil",
  [ing("Ibuprofen", "ibuprofen", mg(200, "tablet"))],
  {
    do_not_use: ["if you have ever had an allergic reaction to any other pain reliever/fever reducer", "right before or after heart surgery"],
    ask_doctor_or_pharmacist: [
      "you are under a doctor's care for any serious condition",
      "taking aspirin for heart attack or stroke, because ibuprofen may decrease this benefit of aspirin",
      "taking any other drug",
    ],
    warnings: [
      "Allergy alert: Ibuprofen may cause a severe allergic reaction, especially in people allergic to aspirin.",
      NSAID_STOMACH,
      "The chance is higher if you are age 60 or older",
      NSAID_OTHER_DRUGS,
      "Heart attack and stroke warning: NSAIDs, except aspirin, increase the risk of heart attack, heart failure, and stroke.",
    ],
  },
  ["Allergy alert: Ibuprofen may cause a severe allergic reaction, especially in people allergic to aspirin."],
);

export const motrin = formulation(
  "f-motrin",
  "Motrin IB",
  [ing("Ibuprofen", "ibuprofen", mg(200, "caplet"))],
  {
    do_not_use: ["if you have ever had an allergic reaction to ibuprofen or any other pain reliever/fever reducer"],
    warnings: [
      "Stomach bleeding warning This product contains an NSAID, which may cause severe stomach bleeding.",
      "take other drugs containing prescription or nonprescription NSAIDs [aspirin, ibuprofen, naproxen, or others]",
    ],
  },
);

export const aleve = formulation(
  "f-aleve",
  "Aleve",
  [ing("Naproxen sodium", "naproxen", mg(220, "caplet"))],
  {
    warnings: [
      "Stomach bleeding warning : This product contains an NSAID, which may cause severe stomach bleeding.",
      "take other drugs containing prescription or nonprescription NSAIDs (aspirin, ibuprofen, naproxen, or others)",
    ],
  },
);

/** An Aleve row imported without its Drug Facts sections: nothing to quote. */
export const aleveNoLabel = { ...formulation("f-aleve-bare", "Aleve", aleve.activeIngredients, {}) };

export const tylenol = formulation(
  "f-tylenol",
  "Tylenol Extra Strength",
  [ing("Acetaminophen", "acetaminophen", mg(500, "caplet"))],
  {
    do_not_use: [
      "with any other drug containing acetaminophen (prescription or nonprescription).",
      "If you are not sure whether a drug contains acetaminophen, ask a doctor or pharmacist.",
    ],
    warnings: ["Liver warning This product contains acetaminophen.", "with other drugs containing acetaminophen"],
  },
  ["Liver warning This product contains acetaminophen.", ACETAMINOPHEN_DO_NOT_USE],
);

export const nyquil = formulation(
  "f-nyquil",
  "NyQuil Cold & Flu",
  [
    ing("Acetaminophen", "acetaminophen", mg(325, "caplet")),
    ing("Dextromethorphan HBr", "dextromethorphan", mg(10, "caplet")),
    ing("Doxylamine succinate", "doxylamine", mg(6.25, "caplet")),
  ],
  {
    do_not_use: ["with any other drug containing acetaminophen (prescription or nonprescription)."],
    warnings: ["Liver warning: This product contains acetaminophen.", "with other drugs containing acetaminophen"],
  },
  ["Liver warning: This product contains acetaminophen."],
);

export const advilPm = formulation(
  "f-advil-pm",
  "Advil PM",
  [ing("Diphenhydramine hydrochloride", "diphenhydramine", mg(25, "capsule")), ing("Ibuprofen", "ibuprofen", mg(200, "capsule"))],
  {
    do_not_use: ["with any other product containing diphenhydramine, even one used on skin"],
    ask_doctor_or_pharmacist: ["you are taking sedatives or tranquilizers, or any other sleep-aid", "taking any other antihistamines"],
    warnings: ["take other drugs containing prescription or nonprescription NSAIDs [aspirin, ibuprofen, naproxen, or others]"],
  },
);

export const pepcid = formulation(
  "f-pepcid",
  "Pepcid AC",
  [ing("Famotidine", "famotidine", mg(10, "tablet"))],
  {
    do_not_use: ["with other acid reducers"],
    ask_doctor_or_pharmacist: ["Acid reducers may interact with certain prescription drugs."],
    warnings: ["Allergy alert Do not use if you are allergic to famotidine or other acid reducers"],
  },
  ["Do not use if you are allergic to famotidine or other acid reducers"],
);

export const prilosec = formulation(
  "f-prilosec",
  "Prilosec OTC",
  [ing("Omeprazole magnesium", "omeprazole", mg(20, "tablet"))],
  { ask_doctor_or_pharmacist: ["Acid reducers may interact with certain prescription drugs."] },
);

export const nexium = formulation(
  "f-nexium",
  "Nexium 24HR",
  [ing("Esomeprazole magnesium", "esomeprazole", mg(20, "capsule"))],
  { ask_doctor_or_pharmacist: ["Acid reducers may interact with certain prescription drugs."] },
);

export const FAMILY_FORMULATIONS: Record<string, Formulation> = Object.fromEntries(
  [advil, motrin, aleve, aleveNoLabel, tylenol, nyquil, advilPm, pepcid, prilosec, nexium].map((f) => [f.id, f]),
);
