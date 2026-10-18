// Imports every US oral OTC drug label into `formulations`: one row per FDA label (slug otc-<set_id>),
// source 'openfda', reviewed_at null. Joins the openFDA Drug Label API with the NDC Directory bulk file.
// Spec: docs/superpowers/specs/2026-10-17-otc-catalog-design.md §1. Mapping: src/lib/fda/.
//
//   npm run import:otc -- --dry-run            fetch, map and report; writes nothing
//   npm run import:otc                         upsert on slug in batches (SUPABASE_SECRET_KEY)
//   flags: --with-medlineplus                  add MedlinePlus ingredient links (≤100 req/min, cached)
//          --prune                             delete imported rows (otc-…, unreviewed) this run no longer
//                                              produces, except rows a saved entry references; with
//                                              --dry-run it only prints what it would delete
//          --no-spl                            skip DailyMed SPL XML (bullets from text heuristics only)
//          --refresh                           re-download instead of using .cache/fda
//
// Downloads are untrusted data: cached under .cache/fda (gitignored), parsed only (JSON, XML).
// Hand-checked rows (reviewed_at set) are never touched; labels sharing a package NDC with one are skipped.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { unzipSync } from "fflate";
import { formatStrength } from "@/lib/domain/fields";
import { indexNdcProducts } from "@/lib/fda/join";
import { importLabels, REJECT_REASONS, type ImportResult } from "@/lib/fda/map";
import { ingredientSetKey, medlinePlusLinks, medlinePlusQueryUrl } from "@/lib/fda/medlineplus";
import { planPrune, type CatalogRowRef } from "@/lib/fda/prune";
import { labelSourceTexts } from "@/lib/fda/sections";
import { parseSpl, splUrl, type SplSections } from "@/lib/fda/spl";
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
const withSpl = !args.has("--no-spl");
const doPrune = args.has("--prune");
const SPL_CONCURRENCY = 4;

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


/** DailyMed SPL XML per label (cached; parse-only). Missing or failed documents fall back to text heuristics. */
async function loadSpl(setIds: string[]): Promise<{ spl: Map<string, SplSections>; missing: number; failed: number }> {
  const spl = new Map<string, SplSections>();
  let missing = 0;
  let failed = 0;
  let done = 0;
  const queue = [...setIds];
  const worker = async () => {
    for (let setId = queue.shift(); setId; setId = queue.shift()) {
      const file = path.join(CACHE, "spl", `${setId}.xml`);
      const marker = path.join(CACHE, "spl", `${setId}.missing`);
      let xml = (await readCached(file))?.toString("utf8") ?? null;
      if (!xml && !(await readCached(marker))) {
        const res = await fetch(splUrl(setId), { signal: AbortSignal.timeout(60_000) }).catch(() => null);
        if (res?.ok) {
          xml = await res.text();
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file, xml);
        } else if (res?.status === 404) {
          await mkdir(path.dirname(marker), { recursive: true });
          await writeFile(marker, "");
        } else {
          failed++;
        }
        await sleep(150);
      }
      if (xml) {
        const parsed = parseSpl(xml);
        if (parsed.setId === setId) spl.set(setId, parsed);
        else failed++;
      } else {
        missing++;
      }
      if (++done % 250 === 0) process.stdout.write(`\r  SPL XML: ${done}/${setIds.length}`);
    }
  };
  await Promise.all(Array.from({ length: SPL_CONCURRENCY }, worker));
  process.stdout.write("\n");
  return { spl, missing, failed };
}

/** MedlinePlus Connect: one query per distinct ingredient set and form, by one of its package NDCs; cached. */
async function addMedlinePlus(rows: CatalogFormulation[], labels: FdaLabel[]) {
  const ndcBySet = new Map(labels.map((l) => [l.set_id, l.openfda?.package_ndc?.[0]]));
  const groups = new Map<string, CatalogFormulation[]>();
  for (const r of rows) {
    const key = ingredientSetKey(r.activeIngredients.map((i) => i.normalized), r.dosageForm);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  console.log(`  MedlinePlus: ${groups.size} distinct ingredient sets × forms`);
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
    for (const r of group) r.sourceLinks = [...r.sourceLinks, ...medlinePlusLinks(data, r.dosageForm)];
    if (n % 50 === 0) process.stdout.write(`\r  MedlinePlus: ${n}/${groups.size}`);
  }
  process.stdout.write("\n");
}

/** Every row in pages of 1000 (PostgREST's default cap). */
async function selectAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/** Imported rows this run no longer produces, minus those a saved entry references. Reads only. */
async function prunePlan(produced: Set<string>) {
  const client = supabase(process.env.SUPABASE_SECRET_KEY); // medication_entries is RLS-protected; selects only
  if (!client) throw new Error("--prune needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (.env.local)");
  const existing = await selectAll<CatalogRowRef>((from, to) =>
    client.from("formulations").select("id, slug, source, reviewed_at").eq("source", "openfda").is("reviewed_at", null).like("slug", "otc-%").order("slug").range(from, to),
  );
  const refs = await selectAll<{ formulation_id: string | null }>((from, to) =>
    client.from("medication_entries").select("formulation_id").not("formulation_id", "is", null).order("id").range(from, to),
  );
  return { existing: existing.length, ...planPrune(existing, produced, new Set(refs.map((r) => r.formulation_id!))) };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function describe(r: CatalogFormulation, note = "", full = false): string {
  const strengths = r.activeIngredients.map((i) => `${i.name} [${i.normalized}] ${formatStrength(i.strength)}`).join(" + ");
  const cut = (b: string) => (full || b.length <= 110 ? b : `${b.slice(0, 110)}…`);
  const sections = Object.entries(r.labelSections)
    .map(([k, v]) => `    ${k} (${v.length}): ${(full ? v : v.slice(0, 3)).map((b) => JSON.stringify(cut(b))).join(" | ")}`)
    .join("\n");
  return [
    `  ${r.slug}${note}`,
    `    ${r.brandName} — ${r.labelerName} — ${r.dosageForm} — ${strengths}`,
    `    ${r.ndcPackages.length} package NDCs | label ${r.labelEffectiveDate} | 24-h: ${r.max24hText ?? "none"} | ${r.warningsQuotes.length} warning quotes | table: ${r.dosageTableHtml ? "yes" : "no"}`,
    `    directions_text: ${JSON.stringify(cut(r.directionsText ?? ""))}`,
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

/** Rows the verifiers flagged; the report shows what each is now. */
const FLAGGED = [
  "cf0987a3", "d0eff659", "e696038c", "4f7125aa", "04a78a5c", "581f81a0", "a39c772b", "90b5c3d8", "12a38e29", "ae63fe31",
];
const ADVIL = "1a665e64-9f30-be37-4a83-38789f1f1e89";

async function report(labels: FdaLabel[], products: number, exportDate: string, result: ImportResult, splStats: string) {
  const rows = result.rows;
  console.log(`\n=== OTC import ${dryRun ? "DRY RUN (nothing written)" : ""} ===`);
  console.log(`labels fetched: ${labels.length} | NDC Directory OTC products: ${products} (export ${exportDate})`);
  const joined = result.joins.spl_id + result.joins.package_ndc;
  console.log(
    `join: spl_id ${result.joins.spl_id}, package_ndc ${result.joins.package_ndc}, none ${result.joins.none} → ${((100 * joined) / Math.max(1, labels.length)).toFixed(2)}% joined`,
  );
  console.log(`SPL XML: ${splStats}`);
  console.log(`rows produced: ${rows.length}`);
  console.log("rejects by reason:");
  for (const reason of REJECT_REASONS) {
    if (!result.rejects[reason]) continue;
    console.log(`  ${reason}: ${result.rejects[reason]}`);
    for (const example of result.rejectExamples[reason] ?? []) console.log(`      e.g. ${example}`);
  }
  const s = result.strengthSources;
  const total = s.label_and_ndc + s.label + s.ndc_per;
  console.log(
    `strength traceability gate: ${result.traceableRows} mapped rows with every strength traced to the label's Active ingredient text; ${result.rejects.untraceable_strength ?? 0} rejected`,
  );
  console.log(
    `  ${total} stored strengths: ${s.label_and_ndc} label + NDC agree, ${s.label} label only (NDC disagreed or none), ${s.ndc_per} label amount with the NDC's per-quantity`,
  );

  const bySetId = new Map(labels.map((l) => [l.set_id, l]));
  let bullets = 0;
  const reworded: string[] = [];
  for (const r of rows) {
    const sources = labelSourceTexts(bySetId.get(r.openfdaSetId ?? "")!);
    for (const [key, list] of Object.entries(r.labelSections)) {
      for (const b of list) {
        bullets++;
        if (!sources.some((t) => t.includes(b))) reworded.push(`${r.slug} ${key}: ${b}`);
      }
    }
  }
  console.log(`no-rewording check: ${bullets} bullets, ${reworded.length} not found verbatim in the label text`);
  reworded.slice(0, 5).forEach((x) => console.log(`  ! ${x}`));
  const lengths = rows.flatMap((r) => Object.values(r.labelSections).flat().map((b) => b.length)).sort((a, b) => a - b);
  const pct = (p: number) => lengths[Math.floor((lengths.length - 1) * p)] ?? 0;
  console.log(`bullet length (chars): median ${pct(0.5)}, p90 ${pct(0.9)}, p99 ${pct(0.99)}, max ${pct(1)}`);
  const tableOnly = rows.filter((r) => !r.labelSections.directions && r.dosageTableHtml).length;
  const noDirections = rows.filter((r) => !r.labelSections.directions && !r.dosageTableHtml).length;
  console.log(`directions only in the dosing table (directions empty, table set): ${tableOnly}; no directions and no table: ${noDirections}`);

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
  console.log(`rows with a MedlinePlus link: ${rows.filter((r) => r.sourceLinks.some((l) => l.label.startsWith("MedlinePlus"))).length}`);

  console.log("flagged rows now:");
  for (const prefix of FLAGGED) {
    const setId = labels.find((l) => l.set_id?.startsWith(prefix))?.set_id ?? prefix;
    const status = result.status.get(setId) ?? "not in this run";
    const row = rows.find((r) => r.openfdaSetId === setId);
    const strengths = row ? row.activeIngredients.map((i) => `${i.name} ${formatStrength(i.strength)}`).join(" + ") : "";
    console.log(`  otc-${setId}: ${status === "row" ? `row — ${strengths}` : `rejected: ${status}`}`);
  }

  console.log("sample rows:");
  for (const [name, test] of SAMPLES) {
    const row = rows.find(test);
    const skipped = row ? undefined : result.skippedForReviewed.find(test);
    if (row) console.log(`- ${name}\n${describe(row, "", row.openfdaSetId === ADVIL)}`);
    else if (skipped) console.log(`- ${name} (skipped: package NDC on a reviewed row)\n${describe(skipped)}`);
    else console.log(`- ${name}: no match`);
  }

  const live = supabase(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (live) {
    const { data } = await live.from("formulations").select("active_ingredients, label_sections, directions_text").eq("slug", `otc-${ADVIL}`).maybeSingle();
    if (data) {
      console.log(`Advil as live now (before this run):`);
      console.log(`    directions_text: ${JSON.stringify(data.directions_text)}`);
      for (const [k, v] of Object.entries((data.label_sections ?? {}) as Record<string, string[]>)) console.log(`    ${k} (${v.length}): ${v.map((b) => JSON.stringify(b)).join(" | ")}`);
    }
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
  const index = indexNdcProducts(products);

  let splStats = "skipped (--no-spl)";
  let result = importLabels(labels, index, reviewed);
  if (withSpl) {
    // Fetch SPL XML only for labels that become rows (or would, but for a reviewed row), then map again.
    const candidates = [...result.rows, ...result.skippedForReviewed].map((r) => r.openfdaSetId!).filter(Boolean);
    const { spl, missing, failed } = await loadSpl(candidates);
    splStats = `${spl.size} of ${candidates.length} candidate labels have a matching SPL document; ${missing} not on DailyMed, ${failed} failed (text heuristics used for those)`;
    result = importLabels(labels, index, reviewed, { spl });
  }
  if (withMedlinePlus) await addMedlinePlus(result.rows, labels);
  else console.log("  MedlinePlus links: skipped (pass --with-medlineplus)");
  await report(labels, products.length, exportDate, result, splStats);

  let plan: Awaited<ReturnType<typeof prunePlan>> | null = null;
  if (doPrune) {
    plan = await prunePlan(new Set(result.rows.map((r) => r.slug)));
    console.log(`prune: ${plan.existing} imported rows in the table; ${plan.remove.length} not produced by this run would be deleted${dryRun ? " (dry run: nothing deleted)" : ""}`);
    plan.remove.slice(0, 15).forEach((r) => console.log(`  - ${r.slug}`));
    if (plan.remove.length > 15) console.log(`  … and ${plan.remove.length - 15} more`);
    console.log(`  kept because a saved medication entry references them: ${plan.keptReferenced.length}`);
    plan.keptReferenced.forEach((r) => console.log(`  = ${r.slug}`));
  }

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

  if (plan && plan.remove.length > 0) {
    const ids = plan.remove.map((r) => r.id);
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await admin
        .from("formulations")
        .delete()
        .in("id", ids.slice(i, i + 200))
        .eq("source", "openfda")
        .is("reviewed_at", null)
        .like("slug", "otc-%");
      if (error) throw new Error(`prune batch at ${i}: ${error.message}`);
    }
    console.log(`  pruned ${ids.length} rows`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
