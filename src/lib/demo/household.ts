// The demo household: everything synthetic. Pure, so it can be tested without a database.
import { FICTIONAL_FORMULATIONS } from "@/data/fictional-formulations";
import { emptyEntryFields, emptyField, fieldsFromFormulation } from "@/lib/domain/fields";
import type {
  EntryFields,
  Evidence,
  Field,
  Formulation,
  InputMethod,
  SourceDocumentKind,
  Strength,
} from "@/lib/domain/schema";

export const DEMO_CAREGIVER_NAME = "Alex Rivera";
export const DEMO_TYLENOL_SLUG = "tylenol-extra-strength-500mg-caplet";
export const DEMO_CALMORA_SLUG = "calmora-fever-relief-100mg-5ml";

export type DemoEntry = {
  formulationSlug: string;
  formulationId: string | null;
  inputMethod: InputMethod;
  /** Null for catalog picks: nothing was photographed or scanned, so there is no source document. */
  documentKind: SourceDocumentKind | null;
  fields: EntryFields;
};

export type DemoPatient = {
  displayName: string;
  relationship: string;
  notes: string | null;
  entries: DemoEntry[];
};

export type DemoHousehold = { caregiverName: string; patients: DemoPatient[] };

/**
 * Alex Rivera's household: "Me (Alex)" with Tylenol Extra Strength on file, and Sam (13, son)
 * with Calmora Fever Relief (Bottle A). Both entries are confirmed. Catalog rows are used when
 * present; otherwise the entries are built without a catalog link.
 * `includeSelf: false` leaves out Alex's own profile (for someone who already has one of their own).
 */
export function buildDemoHousehold(
  formulations: Formulation[],
  { includeSelf = true }: { includeSelf?: boolean } = {},
): DemoHousehold {
  const bySlug = (slug: string) => formulations.find((f) => f.slug === slug) ?? null;
  const tylenol = bySlug(DEMO_TYLENOL_SLUG);
  const calmora = bySlug(DEMO_CALMORA_SLUG);

  const me: DemoPatient = {
    displayName: "Alex",
    relationship: "self",
    notes: null,
    entries: [
      {
        formulationSlug: DEMO_TYLENOL_SLUG,
        formulationId: tylenol?.id ?? null,
        inputMethod: "picker",
        documentKind: null,
        fields: confirmAll(tylenol ? fieldsFromFormulation(tylenol) : tylenolFallbackFields()),
      },
    ],
  };

  const sam: DemoPatient = {
    displayName: "Sam",
    relationship: "son",
    notes: "Age 13",
    entries: [
      {
        formulationSlug: DEMO_CALMORA_SLUG,
        formulationId: calmora?.id ?? null,
        inputMethod: "picker",
        documentKind: null,
        fields: confirmAll(calmora ? fieldsFromFormulation(calmora) : calmoraFallbackFields()),
      },
    ],
  };

  return { caregiverName: DEMO_CAREGIVER_NAME, patients: includeSelf ? [me, sam] : [sam] };
}

function tylenolFallbackFields(): EntryFields {
  const demo: Evidence = { kind: "quote", text: "Demo record" };
  const field = <T>(value: T): Field<T> => ({ aiValue: value, value, state: "pending", evidence: demo });
  const strength: Strength = { amount: 500, unit: "mg", perAmount: 1, perUnit: "caplet" };
  return {
    ...emptyEntryFields(),
    productName: field("Tylenol Extra Strength"),
    dosageForm: field("caplet"),
    ingredients: [{ name: field("Acetaminophen"), strength: field(strength) }],
    instructions: emptyField(),
    max24h: emptyField(),
  };
}

/** The fictional product itself. With no catalog row to point at, the evidence quotes the label text. */
function calmoraFallbackFields(): EntryFields {
  const fictional = FICTIONAL_FORMULATIONS.find((f) => f.slug === DEMO_CALMORA_SLUG);
  if (!fictional) throw new Error(`Demo product ${DEMO_CALMORA_SLUG} is missing`);
  return mapFields(fieldsFromFormulation({ ...fictional, id: "" }), (f) => {
    if (f.evidence.kind !== "database") return f;
    const evidence: Evidence = f.evidence.text ? { kind: "quote", text: f.evidence.text } : { kind: "none" };
    return { ...f, evidence };
  });
}

/** Marks every field as confirmed by the (synthetic) user. Fields with no value stay unknown. */
function confirmAll(fields: EntryFields): EntryFields {
  return mapFields(fields, (f) => (f.value === null ? { ...f, state: "unknown" } : { ...f, state: "confirmed" }));
}

function mapFields(fields: EntryFields, fn: <T>(f: Field<T>) => Field<T>): EntryFields {
  return {
    productName: fn(fields.productName),
    dosageForm: fn(fields.dosageForm),
    ingredients: fields.ingredients.map((i) => ({ name: fn(i.name), strength: fn(i.strength) })),
    instructions: fn(fields.instructions),
    doseAsWritten: fn(fields.doseAsWritten),
    max24h: fn(fields.max24h),
  };
}
