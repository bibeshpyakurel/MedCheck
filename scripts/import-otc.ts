// Imports every US oral OTC drug label into `formulations`: one row per FDA label (slug otc-<set_id>),
// source 'openfda', reviewed_at null. Joins the openFDA Drug Label API with the NDC Directory bulk file.
// Spec: docs/superpowers/specs/2026-10-17-otc-catalog-design.md §1. Mapping: src/lib/fda/.
//
//   npm run import:otc -- --dry-run            fetch, map and report; writes nothing
//   npm run import:otc                         upsert on slug in batches (SUPABASE_SECRET_KEY)
//   flags: --with-medlineplus                  add MedlinePlus ingredient links (≤100 req/min, cached)
//          --refresh                           re-download instead of using .cache/fda
//
// Downloads are untrusted data: cached under .cache/fda (gitignored), parsed as JSON only.
// Hand-checked rows (reviewed_at set) are never touched; labels sharing a package NDC with one are skipped.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { unzipSync } from "fflate";
import { formatStrength } from "@/lib/domain/fields";
import type { LabelSectionKey } from "@/lib/domain/schema";
import { indexNdcProducts } from "@/lib/fda/join";
import { importLabels, REJECT_REASONS, type ImportResult } from "@/lib/fda/map";
import { ingredientSetKey, medlinePlusLinks, medlinePlusQueryUrl } from "@/lib/fda/medlineplus";
import { sectionText } from "@/lib/fda/sections";
import type { FdaLabel, NdcProduct } from "@/lib/fda/types";
import { formulationToRow, type CatalogFormulation } from "@/lib/openfda";
import type { Database } from "@/lib/supabase/database.types";

const CACHE = path.resolve(process.cwd(), ".cache/fda");
const LABEL_ENDPOINT = "https://api.fda.gov/drug/label.json";
const LABEL_SEARCH =
  'openfda.product_type:"HUMAN OTC DRUG" AND (openfda.route:"ORAL" OR openfda.route:"SUBLINGUAL" OR openfda.route:"BUCCAL")';
const PAGE_SIZE = 1000; // openFDA max
const SKIP_CAP = 25_000; // openFDA max skip
const DOWNLOAD_INDEX = "https://api.fda.gov/download.json";
const NDC_DOWNLOAD_PREFIX = "https://download.open.fda.gov/drug/ndc/";
const UPSERT_BATCH = 500;

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const refresh = args.has("--refresh");
const withMedlinePlus = args.has("--with-medlineplus");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sha = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);

async function readCached(file: string): Promise<Buffer | null> {
  if (refresh) return null;
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}

async function fetchBytes(url: string, timeoutMs = 300_000): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) }).catch((e: unknown) => e as Error);
    if (res instanceof Response && res.ok) return Buffer.from(await res.arrayBuffer());
    const why = res instanceof Response ? `HTTP ${res.status}` : res.message;
    const retryable = !(res instanceof Response) || res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 4) throw new Error(`GET ${url} failed: ${why}`);
    console.warn(`  ${why} — retrying in ${attempt * 10}s`);
    await sleep(attempt * 10_000);
  }
}

/** JSON from the cache, else fetched and cached. Parsed as JSON only — never evaluated. */
async function cachedJson(file: string, url: string, timeoutMs?: number): Promise<{ data: unknown; fetched: boolean }> {
  const cached = await readCached(file);
  if (cached) return { data: JSON.parse(cached.toString("utf8")), fetched: false };
  const bytes = await fetchBytes(url, timeoutMs);
  const data = JSON.parse(bytes.toString("utf8"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return { data, fetched: true };
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

type LabelPage = { meta?: { results?: { total?: number } }; results?: unknown };

async function loadLabels(): Promise<FdaLabel[]> {
  const dir = path.join(CACHE, "labels", sha(LABEL_SEARCH));
  const page = async (n: number) => {
    const url = `${LABEL_ENDPOINT}?${new URLSearchParams({ search: LABEL_SEARCH, limit: String(PAGE_SIZE), skip: String(n * PAGE_SIZE), sort: "set_id:asc" })}`;
    const { data, fetched } = await cachedJson(path.join(dir, `page-${String(n).padStart(3, "0")}.json`), url);
    if (fetched) await sleep(500); // ~240 req/min without a key; stay well under
    const body = data as LabelPage;
    if (!Array.isArray(body.results)) throw new Error(`label page ${n}: no results array`);
    return { total: Number(body.meta?.results?.total ?? 0), results: body.results as FdaLabel[] };
  };
  const first = await page(0);
  if (first.total > SKIP_CAP + PAGE_SIZE) throw new Error(`${first.total} labels exceed openFDA's skip cap; switch to the bulk label files`);
  const labels = [...first.results];
  const pages = Math.ceil(first.total / PAGE_SIZE);
  for (let n = 1; n < pages; n++) {
    labels.push(...(await page(n)).results);
    process.stdout.write(`\r  labels: page ${n + 1}/${pages}`);
  }
  if (pages > 1) process.stdout.write("\n");
  const unique = new Set(labels.map((l) => l.set_id)).size;
  if (labels.length !== first.total || unique !== labels.length) {
    console.warn(`! label pages: ${labels.length} results, ${unique} unique set ids, API total ${first.total}`);
  }
  return labels;
}

/** Only the NDC Directory fields the mapper reads, for HUMAN OTC DRUG products. */
function trimProduct(p: Record<string, unknown>): NdcProduct {
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined);
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return {
    product_ndc: str(p.product_ndc),
    spl_id: str(p.spl_id),
    product_type: str(p.product_type),
    brand_name: str(p.brand_name),
    generic_name: str(p.generic_name),
    labeler_name: str(p.labeler_name),
    dosage_form: str(p.dosage_form),
    route: strings(p.route),
    finished: typeof p.finished === "boolean" ? p.finished : undefined,
    active_ingredients: Array.isArray(p.active_ingredients)
      ? p.active_ingredients.map((i: { name?: unknown; strength?: unknown }) => ({ name: str(i?.name), strength: str(i?.strength) }))
      : undefined,
    packaging: Array.isArray(p.packaging) ? p.packaging.map((k: { package_ndc?: unknown }) => ({ package_ndc: str(k?.package_ndc) })) : undefined,
  };
}

async function loadNdcProducts(): Promise<{ products: NdcProduct[]; exportDate: string }> {
  const derived = path.join(CACHE, "ndc", "otc-products.json");
  const cached = await readCached(derived);
  if (cached) return JSON.parse(cached.toString("utf8"));

  const { data: index } = await cachedJson(path.join(CACHE, "download.json"), DOWNLOAD_INDEX);
  const ndc = (index as { results?: { drug?: { ndc?: { export_date?: string; partitions?: { file?: unknown }[] } } } }).results?.drug?.ndc;
  const files = (ndc?.partitions ?? []).map((p) => p.file);
  if (files.length === 0) throw new Error("download.json lists no NDC partitions");

  const products: NdcProduct[] = [];
  for (const file of files) {
    const base = typeof file === "string" && file.startsWith(NDC_DOWNLOAD_PREFIX) ? file.slice(NDC_DOWNLOAD_PREFIX.length) : "";
    if (!/^[\w.-]+\.json\.zip$/.test(base)) throw new Error(`unexpected NDC partition URL: ${String(file)}`);
    const zipPath = path.join(CACHE, "ndc", base);
    let zip = await readCached(zipPath);
    if (!zip) {
      console.log(`  downloading ${base}`);
      zip = await fetchBytes(file as string, 600_000);
      await mkdir(path.dirname(zipPath), { recursive: true });
      await writeFile(zipPath, zip);
    }
    const entries = unzipSync(new Uint8Array(zip), { filter: (f) => /^[\w.-]+\.json$/.test(f.name) });
    for (const bytes of Object.values(entries)) {
      const body = JSON.parse(new TextDecoder().decode(bytes)) as { results?: Record<string, unknown>[] };
      for (const p of body.results ?? []) if (p.product_type === "HUMAN OTC DRUG") products.push(trimProduct(p));
    }
  }
  const out = { products, exportDate: ndc?.export_date ?? "unknown" };
  await writeFile(derived, JSON.stringify(out));
  return out;
}

function supabase(key: string | undefined) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !key) return null;
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Package NDCs on hand-checked rows. The dry run reads with the publishable key (catalog is public). */
async function reviewedNdcs(): Promise<Set<string>> {
  const client = supabase(dryRun ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : process.env.SUPABASE_SECRET_KEY);
  if (!client) {
    if (!dryRun) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (.env.local)");
    console.warn("! no Supabase env — dry run can't check reviewed rows");
    return new Set();
  }
  const { data, error } = await client.from("formulations").select("slug, ndc_packages").not("reviewed_at", "is", null);
  if (error) throw error;
  console.log(`  reviewed rows: ${data.length}`);
  return new Set(data.flatMap((r) => r.ndc_packages));
}

/** MedlinePlus Connect: one query per distinct ingredient set, by one of its package NDCs; cached. */
async function addMedlinePlus(rows: CatalogFormulation[], labels: FdaLabel[]) {
  const ndcBySet = new Map(labels.map((l) => [l.set_id, l.openfda?.package_ndc?.[0]]));
  const groups = new Map<string, CatalogFormulation[]>();
  for (const r of rows) {
    const key = ingredientSetKey(r.activeIngredients.map((i) => i.normalized));
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  console.log(`  MedlinePlus: ${groups.size} distinct ingredient sets`);
  let n = 0;
  for (const [key, group] of groups) {
    n++;
    const ndc = group.map((r) => ndcBySet.get(r.openfdaSetId ?? "")).find((x) => x && /^\d{4,5}-\d{3,4}-\d{1,2}$/.test(x));
    if (!ndc) continue;
    const { data, fetched } = await cachedJson(path.join(CACHE, "medlineplus", `${sha(key)}.json`), medlinePlusQueryUrl(ndc), 30_000).catch(
      (e: Error) => {
        console.warn(`\n  MedlinePlus ${key}: ${e.message}`);
        return { data: null, fetched: false };
      },
    );
    if (fetched) await sleep(650); // ≤100 req/min
    const links = medlinePlusLinks(data);
    for (const r of group) r.sourceLinks = [...r.sourceLinks, ...links];
    if (n % 50 === 0) process.stdout.write(`\r  MedlinePlus: ${n}/${groups.size}`);
  }
  process.stdout.write("\n");
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function describe(r: CatalogFormulation, note = ""): string {
  const strengths = r.activeIngredients.map((i) => `${i.name} [${i.normalized}] ${formatStrength(i.strength)}`).join(" + ");
  const sections = Object.entries(r.labelSections)
    .map(([k, v]) => `    ${k} (${v.length}): ${v.slice(0, 3).map((b) => JSON.stringify(b.length > 110 ? `${b.slice(0, 110)}…` : b)).join(" | ")}`)
    .join("\n");
  return [
    `  ${r.slug}${note}`,
    `    ${r.brandName} — ${r.labelerName} — ${r.dosageForm} — ${strengths}`,
    `    ${r.ndcPackages.length} package NDCs | label ${r.labelEffectiveDate} | 24-h: ${r.max24hText ?? "none"} | ${r.warningsQuotes.length} warning quotes | table: ${r.dosageTableHtml ? "yes" : "no"}`,
    `    sources: ${r.sourceLinks.map((l) => l.label).join(", ")}`,
    sections,
  ].join("\n");
}

const SAMPLES: [string, (r: CatalogFormulation) => boolean][] = [
  ["Advil", (r) => /^advil$/i.test(r.brandName) && /haleon/i.test(r.labelerName ?? "")],
  ["Tylenol 500 mg", (r) => /^tylenol extra strength$/i.test(r.brandName) && r.activeIngredients.some((i) => i.strength.amount === 500)],
  ["Children's Tylenol 160 mg/5 mL", (r) => /^children'?s tylenol$/i.test(r.brandName) && r.activeIngredients.some((i) => formatStrength(i.strength) === "160 mg per 5 mL")],
  ["NyQuil", (r) => /nyquil/i.test(r.brandName) && /procter/i.test(r.labelerName ?? "")],
];

function report(labels: FdaLabel[], products: number, exportDate: string, result: ImportResult) {
  const rows = result.rows;
  console.log(`\n=== OTC import ${dryRun ? "DRY RUN (nothing written)" : ""} ===`);
  console.log(`labels fetched: ${labels.length} | NDC Directory OTC products: ${products} (export ${exportDate})`);
  const joined = result.joins.spl_id + result.joins.package_ndc;
  console.log(
    `join: spl_id ${result.joins.spl_id}, package_ndc ${result.joins.package_ndc}, none ${result.joins.none} → ${((100 * joined) / Math.max(1, labels.length)).toFixed(2)}% joined`,
  );
  console.log(`rows produced: ${rows.length}`);
  console.log("rejects by reason:");
  for (const reason of REJECT_REASONS) {
    if (!result.rejects[reason]) continue;
    console.log(`  ${reason}: ${result.rejects[reason]}`);
    for (const example of result.rejectExamples[reason] ?? []) console.log(`      e.g. ${example}`);
  }

  // The card's bullets are cut from the label text, never reworded: check it on every row.
  const bySetId = new Map(labels.map((l) => [l.set_id, l]));
  let bullets = 0;
  const reworded: string[] = [];
  for (const r of rows) {
    const label = bySetId.get(r.openfdaSetId ?? "")!;
    for (const [key, list] of Object.entries(r.labelSections) as [LabelSectionKey, string[]][]) {
      const text = sectionText(label, key) ?? "";
      for (const b of list) {
        bullets++;
        if (!text.includes(b)) reworded.push(`${r.slug} ${key}: ${b}`);
      }
    }
  }
  console.log(`no-rewording check: ${bullets} bullets, ${reworded.length} not found verbatim in the label text`);
  reworded.slice(0, 5).forEach((x) => console.log(`  ! ${x}`));
  const lengths = rows.flatMap((r) => Object.values(r.labelSections).flat().map((b) => b.length)).sort((a, b) => a - b);
  const pct = (p: number) => lengths[Math.floor((lengths.length - 1) * p)] ?? 0;
  console.log(`bullet length (chars): median ${pct(0.5)}, p90 ${pct(0.9)}, p99 ${pct(0.99)}, max ${pct(1)}`);

  const forms = new Map<string, number>();
  for (const r of rows) forms.set(r.dosageForm, (forms.get(r.dosageForm) ?? 0) + 1);
  console.log(`dosage forms: ${[...forms].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(", ")}`);

  const ingredients = new Map<string, number>();
  for (const r of rows) for (const n of new Set(r.activeIngredients.map((i) => i.normalized))) ingredients.set(n, (ingredients.get(n) ?? 0) + 1);
  console.log(`distinct normalized ingredients: ${ingredients.size}; top 30:`);
  for (const [name, n] of [...ingredients].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`  ${String(n).padStart(5)}  ${name}`);

  const sectionCounts = new Map<string, number>();
  for (const r of rows) for (const k of Object.keys(r.labelSections)) sectionCounts.set(k, (sectionCounts.get(k) ?? 0) + 1);
  console.log(`rows with each section: ${[...sectionCounts].map(([k, n]) => `${k} ${n}`).join(", ")}`);
  console.log(`rows with a dosing table: ${rows.filter((r) => r.dosageTableHtml).length}; with a 24-h limit: ${rows.filter((r) => r.max24hText).length}`);

  console.log("sample rows:");
  for (const [name, test] of SAMPLES) {
    const row = rows.find(test);
    const skipped = row ? undefined : result.skippedForReviewed.find(test);
    if (row) console.log(`- ${name}\n${describe(row)}`);
    else if (skipped) console.log(`- ${name} (skipped: package NDC on a reviewed row)\n${describe(skipped)}`);
    else console.log(`- ${name}: no match`);
  }

  const bytes = Buffer.byteLength(JSON.stringify(rows.map((r) => formulationToRow(r, null))));
  console.log(`estimated JSON size of rows: ${(bytes / 1e6).toFixed(1)} MB (${Math.round(bytes / Math.max(1, rows.length))} bytes/row)`);
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("Loading FDA data (cache: .cache/fda)…");
  const labels = await loadLabels();
  const { products, exportDate } = await loadNdcProducts();
  const reviewed = await reviewedNdcs();
  const result = importLabels(labels, indexNdcProducts(products), reviewed);
  if (withMedlinePlus) await addMedlinePlus(result.rows, labels);
  else console.log("  MedlinePlus links: skipped (pass --with-medlineplus)");
  report(labels, products.length, exportDate, result);

  if (dryRun) return;
  const admin = supabase(process.env.SUPABASE_SECRET_KEY)!;
  let written = 0;
  for (let i = 0; i < result.rows.length; i += UPSERT_BATCH) {
    const batch = result.rows.slice(i, i + UPSERT_BATCH).map((r) => formulationToRow(r, null));
    const { error } = await admin.from("formulations").upsert(batch, { onConflict: "slug" });
    if (error) throw new Error(`upsert batch at ${i}: ${error.message}`);
    written += batch.length;
    process.stdout.write(`\r  upserted ${written}/${result.rows.length}`);
  }
  process.stdout.write("\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
