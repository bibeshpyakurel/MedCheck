// Measures AI extraction accuracy against the printed demo kit.
//
//   npm run score -- <photo> demo-assets/expected/<item>.json
//
// Sends the photo through the same extractor the app uses (`extractFromPhoto` in
// src/lib/ai/extract-label.ts) and compares every field with the expected values a perfect
// extraction would produce. `scoreExtraction` is pure and unit-tested; the CLI below it is not.
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { suggestedField } from "@/lib/domain/fields";
import { normalizeIngredient } from "@/lib/domain/ingredients";
import {
  doseAsWrittenSchema,
  sourceDocumentKindSchema,
  strengthSchema,
  type DoseAsWritten,
  type EntryFields,
  type Field,
  type SourceDocumentKind,
  type Strength,
} from "@/lib/domain/schema";

// ---------------------------------------------------------------------------
// Expected-values files (demo-assets/expected/*.json)
// ---------------------------------------------------------------------------

const text = z.string().min(1).nullable();

export const expectedMedicationSchema = z.object({
  productName: text,
  dosageForm: text,
  ingredients: z.array(z.object({ name: z.string().min(1), strength: strengthSchema.nullable() })),
  instructions: text,
  doseAsWritten: doseAsWrittenSchema.nullable(),
  max24h: text,
});
export type ExpectedMedication = z.infer<typeof expectedMedicationSchema>;

export const expectedExtractionSchema = z.object({
  item: z.string().min(1),
  kind: sourceDocumentKindSchema,
  description: z.string().optional(),
  document: z.object({
    documentDate: z.iso.date().nullable(),
    facility: text,
    prescriber: text,
    pharmacy: text,
  }),
  medications: z.array(expectedMedicationSchema).min(1),
});
export type ExpectedExtraction = z.infer<typeof expectedExtractionSchema>;

/** The shape `extractFromPhoto()` returns (Workstream B's `ExtractionResult`). */
export type ExtractionLike = {
  document: { documentDate: string | null; facility: string | null; prescriber: string | null; pharmacy: string | null };
  medications: EntryFields[];
};

/** Expected values as `EntryFields` (all confirmed), so the files can be validated against the shared contract. */
export function toEntryFields(m: ExpectedMedication): EntryFields {
  const confirm = <T>(v: T | null): Field<T> => {
    const f = suggestedField(v, { kind: "none" });
    return f.state === "pending" ? { ...f, state: "confirmed" } : f;
  };
  return {
    productName: confirm(m.productName),
    dosageForm: confirm(m.dosageForm),
    ingredients: m.ingredients.map((i) => ({ name: confirm(i.name), strength: confirm(i.strength) })),
    instructions: confirm(m.instructions),
    doseAsWritten: confirm(m.doseAsWritten),
    max24h: confirm(m.max24h),
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type FieldScore = { field: string; match: boolean; expected: string; actual: string };

const MISSING = "(missing)";

/** Case-, whitespace- and trailing-punctuation-insensitive text. */
function normText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim().replace(/[.;:,]+$/, "");
}

function showText(s: string | null | undefined): string {
  return s === undefined ? MISSING : s === null ? "null" : s;
}

function showStrength(s: Strength | null | undefined): string {
  if (s === undefined) return MISSING;
  if (s === null) return "null";
  const per = s.perUnit ? ` per ${s.perAmount ?? 1} ${s.perUnit}` : "";
  return `${s.amount} ${s.unit}${per}`;
}

function showDose(d: DoseAsWritten | null | undefined): string {
  return d === undefined ? MISSING : d === null ? "null" : `${d.amount} ${d.unit}`;
}

function textRow(field: string, expected: string | null, actual: string | null | undefined): FieldScore {
  const match =
    actual !== undefined && (expected === null || actual === null ? expected === actual : normText(expected) === normText(actual));
  return { field, match, expected: showText(expected), actual: showText(actual) };
}

function strengthRow(field: string, expected: Strength | null, actual: Strength | null | undefined): FieldScore {
  const key = (s: Strength) =>
    [s.amount, normText(s.unit), s.perUnit ? (s.perAmount ?? 1) : null, s.perUnit ? normText(s.perUnit) : null].join("|");
  const match = actual !== undefined && (expected === null || actual === null ? expected === actual : key(expected) === key(actual));
  return { field, match, expected: showStrength(expected), actual: showStrength(actual) };
}

function doseRow(field: string, expected: DoseAsWritten | null, actual: DoseAsWritten | null | undefined): FieldScore {
  const match =
    actual !== undefined &&
    (expected === null || actual === null
      ? expected === actual
      : expected.amount === actual.amount && normText(expected.unit) === normText(actual.unit));
  return { field, match, expected: showDose(expected), actual: showDose(actual) };
}

/** The value the extractor produced: the confirmed value when set, else the AI suggestion. */
function valueOf<T>(f: Field<T> | undefined): T | null | undefined {
  if (!f) return undefined;
  return f.value ?? f.aiValue;
}

/** Index in `candidates` of the item to pair with `want`: same key first, then same position. */
function pairIndex<T>(want: string | null, index: number, candidates: T[], keyOf: (c: T) => string | null, used: Set<number>) {
  if (want !== null) {
    const byKey = candidates.findIndex((c, i) => !used.has(i) && keyOf(c) === want);
    if (byKey !== -1) return byKey;
  }
  return index < candidates.length && !used.has(index) ? index : -1;
}

const ingredientKey = (name: string | null | undefined) => (name ? normalizeIngredient(name) : null);

/** Per-field comparison of an extraction against the expected values. Medications and ingredients pair by ingredient name. */
export function scoreExtraction(expected: ExpectedExtraction, actual: ExtractionLike): FieldScore[] {
  const rows: FieldScore[] = [];
  for (const key of ["documentDate", "facility", "prescriber", "pharmacy"] as const) {
    rows.push(textRow(`document.${key}`, expected.document[key], actual.document[key]));
  }
  rows.push({
    field: "medications.count",
    match: expected.medications.length === actual.medications.length,
    expected: String(expected.medications.length),
    actual: String(actual.medications.length),
  });

  const usedMeds = new Set<number>();
  expected.medications.forEach((em, mi) => {
    const firstIngredient = (m: EntryFields) => ingredientKey(valueOf(m.ingredients[0]?.name));
    const ai = pairIndex(ingredientKey(em.ingredients[0]?.name), mi, actual.medications, firstIngredient, usedMeds);
    if (ai !== -1) usedMeds.add(ai);
    const am: EntryFields | undefined = actual.medications[ai];
    const p = `medications[${mi}]`;

    rows.push(textRow(`${p}.productName`, em.productName, valueOf(am?.productName)));
    rows.push(textRow(`${p}.dosageForm`, em.dosageForm, valueOf(am?.dosageForm)));

    const usedIngredients = new Set<number>();
    const actualIngredients = am?.ingredients ?? [];
    em.ingredients.forEach((ei, ii) => {
      const idx = pairIndex(ingredientKey(ei.name), ii, actualIngredients, (i) => ingredientKey(valueOf(i.name)), usedIngredients);
      if (idx !== -1) usedIngredients.add(idx);
      const ai2 = actualIngredients[idx];
      rows.push(textRow(`${p}.ingredients[${ii}].name`, ei.name, valueOf(ai2?.name)));
      rows.push(strengthRow(`${p}.ingredients[${ii}].strength`, ei.strength, valueOf(ai2?.strength)));
    });

    rows.push(textRow(`${p}.instructions`, em.instructions, valueOf(am?.instructions)));
    rows.push(doseRow(`${p}.doseAsWritten`, em.doseAsWritten, valueOf(am?.doseAsWritten)));
    rows.push(textRow(`${p}.max24h`, em.max24h, valueOf(am?.max24h)));
  });
  return rows;
}

/** Percentage of matching fields, rounded to one decimal. */
export function accuracy(scores: FieldScore[]): number {
  if (scores.length === 0) return 0;
  return Math.round((scores.filter((s) => s.match).length / scores.length) * 1000) / 10;
}

export function formatTable(scores: FieldScore[]): string {
  const clip = (s: string) => (s.length > 60 ? `${s.slice(0, 57)}...` : s);
  const header = ["", "field", "expected", "actual"];
  const body = scores.map((s) => [s.match ? "ok" : "XX", s.field, clip(s.expected), clip(s.actual)]);
  const widths = header.map((_, c) => Math.max(...[header, ...body].map((r) => r[c].length)));
  const line = (r: string[]) => r.map((cell, c) => cell.padEnd(widths[c])).join("  ").trimEnd();
  const matched = scores.filter((s) => s.match).length;
  return [line(header), ...body.map(line), "", `${matched}/${scores.length} fields match (${accuracy(scores)}%)`].join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

// Not a literal, so this script typechecks and builds before Workstream B's module exists.
const EXTRACT_MODULE = "@/lib/ai/extract-label";

const MEDIA_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

type ExtractFromPhoto = (image: Uint8Array, mediaType: string, kind: SourceDocumentKind) => Promise<ExtractionLike>;

async function loadExtractor(): Promise<ExtractFromPhoto> {
  // App modules start with `import "server-only"`, which throws unless resolved with the
  // "react-server" condition (as Next does for server code). Apply that condition to it alone.
  registerHooks({
    resolve: (specifier, context, next) =>
      next(specifier, specifier === "server-only" ? { ...context, conditions: [...context.conditions, "react-server"] } : context),
  });
  let mod: { extractFromPhoto?: unknown };
  try {
    mod = await import(EXTRACT_MODULE);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
      throw new Error(
        `Cannot load ${EXTRACT_MODULE} (src/lib/ai/extract-label.ts). It is built by Workstream B — merge it into this branch first.`,
      );
    }
    throw err;
  }
  if (typeof mod.extractFromPhoto !== "function") {
    throw new Error(`${EXTRACT_MODULE} does not export extractFromPhoto(image, mediaType, kind).`);
  }
  return mod.extractFromPhoto as ExtractFromPhoto;
}

async function main(args: string[]): Promise<number> {
  const [imagePath, expectedPath] = args;
  if (!imagePath || !expectedPath) {
    console.error("Usage: npm run score -- <photo.jpg> demo-assets/expected/<item>.json");
    return 2;
  }
  const mediaType = MEDIA_TYPES[extname(imagePath).toLowerCase()];
  if (!mediaType) {
    console.error(`Unsupported image type "${extname(imagePath)}". Use one of: ${Object.keys(MEDIA_TYPES).join(", ")}`);
    return 2;
  }
  const expected = expectedExtractionSchema.parse(JSON.parse(await readFile(expectedPath, "utf8")));
  const image = new Uint8Array(await readFile(imagePath));

  const extractFromPhoto = await loadExtractor();
  console.log(`Extracting ${imagePath} as ${expected.kind} (expected: ${expected.item})...\n`);
  const started = Date.now();
  const actual = await extractFromPhoto(image, mediaType, expected.kind);
  console.log(formatTable(scoreExtraction(expected, actual)));
  console.log(`\nExtraction took ${((Date.now() - started) / 1000).toFixed(1)} s`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    },
  );
}
