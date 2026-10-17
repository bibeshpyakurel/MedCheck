// Content for the printable demo kit (/demo-kit). Everything here is invented for the demo:
// the pharmacy, hospital, prescriber, patient and Calmora products do not exist. The text is what
// the team photographs on stage, and `demo-assets/expected/*.json` is what a perfect extraction of
// it returns — keep the two in step (a test checks they agree).
import { FICTIONAL_FORMULATIONS, type FictionalFormulation } from "./fictional-formulations";

export const DEMO_DISCLAIMER = "FICTIONAL — FOR DEMO ONLY · NOT A REAL PRODUCT";

export const DEMO_PATIENT = { name: "Sam Rivera", dateOfBirth: "2013-03-14" } as const;

// ---------------------------------------------------------------------------
// Calmora Drug Facts panels (Bottle A and Bottle B)
// ---------------------------------------------------------------------------

export type DrugFactsLabel = {
  id: "bottle-a" | "bottle-b";
  formulation: FictionalFormulation;
  /** "Bottle A" / "Bottle B" — what the presenter calls it on stage. */
  nickname: string;
  /** e.g. "4 FL OZ (120 mL)" */
  netContents: string;
  purpose: string;
  uses: string[];
  /** Additional warnings after the label's own liver / do-not-use quotes. */
  askDoctor: string[];
  stopUse: string[];
  keepOut: string;
  otherInformation: string[];
  inactiveIngredients: string;
};

const SHARED_DRUG_FACTS = {
  netContents: "4 FL OZ (120 mL)",
  purpose: "Pain reliever/fever reducer",
  uses: [
    "temporarily reduces fever",
    "temporarily relieves minor aches and pains due to the common cold, flu, sore throat or headache",
  ],
  askDoctor: ["the child has liver disease", "the child is taking the blood thinning drug warfarin"],
  stopUse: [
    "pain gets worse or lasts more than 5 days",
    "fever gets worse or lasts more than 3 days",
    "new symptoms occur",
    "redness or swelling is present",
  ],
  keepOut:
    "Keep out of reach of children. In case of overdose, get medical help or contact a Poison Control Center (1-800-222-1222) right away.",
  otherInformation: [
    "store between 20–25°C (68–77°F)",
    "do not use if printed neck wrap is broken or missing",
    "this is a fictional demo label — there is no real product",
  ],
  inactiveIngredients:
    "anhydrous citric acid, butylparaben, FD&C red no. 40, flavor, glycerin, microcrystalline cellulose, purified water, sodium benzoate, sorbitol solution, sucralose, xanthan gum",
} satisfies Partial<DrugFactsLabel>;

function formulationBySlug(slug: string): FictionalFormulation {
  const f = FICTIONAL_FORMULATIONS.find((x) => x.slug === slug);
  if (!f) throw new Error(`Missing fictional formulation ${slug}`);
  return f;
}

export const DRUG_FACTS_LABELS: DrugFactsLabel[] = [
  {
    id: "bottle-a",
    nickname: "Bottle A",
    formulation: formulationBySlug("calmora-fever-relief-100mg-5ml"),
    ...SHARED_DRUG_FACTS,
  },
  {
    id: "bottle-b",
    nickname: "Bottle B",
    formulation: formulationBySlug("calmora-extra-fever-relief-200mg-5ml"),
    ...SHARED_DRUG_FACTS,
  },
];

/** "9999910005" → "99999-100-05" (5-3-2, the layout the fictional NDCs use). */
export function formatNdc532(ndc10: string): string {
  return `${ndc10.slice(0, 5)}-${ndc10.slice(5, 8)}-${ndc10.slice(8)}`;
}

// ---------------------------------------------------------------------------
// Prescription label
// ---------------------------------------------------------------------------

export const PRESCRIPTION_LABEL = {
  id: "prescription-label",
  pharmacy: "Riverside Community Pharmacy",
  pharmacyAddress: "418 River Bend Road, Fairview, ST 00000",
  pharmacyPhone: "(555) 010-0142",
  rxNumber: "6042187",
  patient: DEMO_PATIENT.name,
  drug: "Acetaminophen oral suspension 160 mg per 5 mL",
  directions: "Give 2 tsp by mouth every 6 hours as needed for fever",
  quantity: "120 mL",
  refills: "0",
  prescriber: "Dr. Jordan Lee",
  dateFilled: "2026-10-16",
  discardAfter: "2027-10-16",
  manufacturer: "Generic (demo)",
  auxiliary: ["SHAKE WELL BEFORE USING", "Contains ACETAMINOPHEN — do not take with other acetaminophen products"],
} as const;

// ---------------------------------------------------------------------------
// Discharge medication list
// ---------------------------------------------------------------------------

export const DISCHARGE_LIST = {
  id: "discharge-list",
  facility: "Lakeside Children's Hospital",
  department: "Pediatric Inpatient Unit",
  facilityAddress: "2200 Lakeshore Drive, Fairview, ST 00000",
  date: "2026-10-16",
  patient: DEMO_PATIENT.name,
  dateOfBirth: DEMO_PATIENT.dateOfBirth,
  mrn: "LCH-0048213",
  attending: "Dr. Jordan Lee",
  medications: [
    {
      medication: "Acetaminophen 160 mg/5 mL oral suspension",
      directions: "10 mL by mouth every 6 hours as needed for fever",
      reason: "Fever",
      status: "NEW",
    },
    {
      medication: "Ondansetron 4 mg ODT",
      directions: "1 tablet by mouth every 8 hours as needed for nausea",
      reason: "Nausea",
      status: "NEW",
    },
  ],
  notes: [
    "Bring this list and all medicine bottles to every appointment.",
    "Questions about your medicines? Ask your pharmacist.",
  ],
} as const;

// ---------------------------------------------------------------------------
// Fallback barcode (a real product code, for when nobody has the box)
// ---------------------------------------------------------------------------

export const FALLBACK_BARCODE = {
  id: "fallback-barcode",
  upcA: "337000523025",
  ndc: "37000-523-02",
  title: "Fallback: NyQuil product code (real NDC) — use if you don't have the box",
} as const;
