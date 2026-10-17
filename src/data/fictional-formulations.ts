// Fictional products for the demo. Invented brand ("Calmora"), invented NDCs in labeler
// range 99999 (not an FDA-assigned labeler). Shared by the catalog seed and the printable demo kit.
// The strengths are what the demo story needs (100 vs 200 mg per 5 mL); they are not real products
// and must never be presented as dosing guidance.
import type { Formulation } from "@/lib/domain/schema";

export type FictionalFormulation = Omit<Formulation, "id"> & {
  /** 10-digit NDC as printed in the barcode (5-3-2 layout, no hyphens). */
  ndc10: string;
  /** UPC-A barcode text: "3" + ndc10 + check digit. */
  upcA: string;
};

const LIVER_WARNING =
  "Liver warning: This product contains acetaminophen. Severe liver damage may occur if your child takes more than 5 doses in 24 hours, which is the maximum daily amount, or with other drugs containing acetaminophen.";
const DO_NOT_USE =
  "Do not use with any other drug containing acetaminophen (prescription or nonprescription). If you are not sure whether a drug contains acetaminophen, ask a doctor or pharmacist.";

export const FICTIONAL_FORMULATIONS: FictionalFormulation[] = [
  {
    slug: "calmora-fever-relief-100mg-5ml",
    brandName: "Calmora Fever Relief (Bottle A)",
    genericName: "Acetaminophen oral suspension",
    dosageForm: "liquid",
    isFictional: true,
    ndc10: "9999910005",
    upcA: "399999100052",
    ndcPackages: ["99999010005"],
    activeIngredients: [
      { name: "Acetaminophen", normalized: "acetaminophen", strength: { amount: 100, unit: "mg", perAmount: 5, perUnit: "mL" } },
    ],
    directionsText:
      "FICTIONAL DEMO LABEL. Shake well before using. Use only the enclosed dosing cup. Do not give more than 5 times in 24 hours.",
    max24hText: "Do not give more than 5 times in 24 hours.",
    warningsQuotes: [LIVER_WARNING, DO_NOT_USE],
    dosageTableHtml: null,
    source: "fictional",
    openfdaSetId: null,
    labelEffectiveDate: "2026-10-01",
  },
  {
    slug: "calmora-extra-fever-relief-200mg-5ml",
    brandName: "Calmora Extra Fever Relief (Bottle B)",
    genericName: "Acetaminophen oral suspension",
    dosageForm: "liquid",
    isFictional: true,
    ndc10: "9999920005",
    upcA: "399999200059",
    ndcPackages: ["99999020005"],
    activeIngredients: [
      { name: "Acetaminophen", normalized: "acetaminophen", strength: { amount: 200, unit: "mg", perAmount: 5, perUnit: "mL" } },
    ],
    directionsText:
      "FICTIONAL DEMO LABEL. Shake well before using. Use only the enclosed dosing cup. Do not give more than 5 times in 24 hours.",
    max24hText: "Do not give more than 5 times in 24 hours.",
    warningsQuotes: [LIVER_WARNING, DO_NOT_USE],
    dosageTableHtml: null,
    source: "fictional",
    openfdaSetId: null,
    labelEffectiveDate: "2026-10-01",
  },
];

/** UPC-A check digit for the first 11 digits. */
export function upcCheckDigit(first11: string): number {
  const digits = first11.split("").map(Number);
  const odd = digits.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
  const even = digits.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0);
  return (10 - ((odd * 3 + even) % 10)) % 10;
}
