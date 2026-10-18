import { describe, expect, it } from "vitest";
import { formatStrength } from "@/lib/domain/fields";
import { ndc11FromHyphenated } from "@/lib/ndc";
import { formulationToRow } from "@/lib/openfda";
import { allFixtureNames, allFixtureProducts, fixtureLabel, fixtureProducts, type FixtureName } from "./__fixtures__";
import { indexNdcProducts } from "./join";
import { importLabels, mapLabel, otcSlug, plausibleStrength, reviewedEnrichment, type MapResult } from "./map";

const index = indexNdcProducts(allFixtureProducts());
const mapOne = (...args: Parameters<typeof mapLabel>): MapResult => mapLabel(...args)[0];
const map = (name: FixtureName): MapResult => mapOne(fixtureLabel(name), index);
const ok = (name: FixtureName) => {
  const r = map(name);
  if (!r.ok) throw new Error(`${name} rejected: ${r.reason}`);
  return r.formulation;
};
const strengths = (name: FixtureName) => ok(name).activeIngredients.map((i) => `${i.normalized} ${formatStrength(i.strength)}`);

describe("otcSlug", () => {
  it("is otc-<set_id>", () => {
    expect(otcSlug("1a665e64-9f30-be37-4a83-38789f1f1e89")).toBe("otc-1a665e64-9f30-be37-4a83-38789f1f1e89");
  });
});

describe("mapLabel — rows", () => {
  it("maps Tylenol Extra Strength caplets", () => {
    const label = fixtureLabel("tylenol-extra-strength-caplet");
    const f = ok("tylenol-extra-strength-caplet");
    expect(f.slug).toBe(`otc-${label.set_id}`);
    expect(f.source).toBe("openfda");
    expect(f.isFictional).toBe(false);
    expect(f.openfdaSetId).toBe(label.set_id);
    expect(f.brandName).toBe("Tylenol Extra Strength");
    expect(f.genericName).toBe("Acetaminophen");
    expect(f.dosageForm).toBe("caplet");
    expect(f.labelerName).toBe("Kenvue Brands LLC");
    expect(f.activeIngredients).toEqual([
      { name: "Acetaminophen", normalized: "acetaminophen", strength: { amount: 500, unit: "mg", perAmount: 1, perUnit: "caplet" } },
    ]);
    expect(ok("nicotine-gum-dot-leaders").activeIngredients[0].name).toBe("Nicotine Polacrilex");
    expect(ok("allegra-60-180").activeIngredients[0].name).toBe("Fexofenadine HCl");
    expect(f.ndcPackages.length).toBeGreaterThan(0);
    for (const ndc of f.ndcPackages) expect(ndc).toMatch(/^\d{11}$/);
    expect(f.sourceLinks).toEqual([
      { label: "FDA label (DailyMed)", url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${label.set_id}` },
    ]);
    expect(f.labelEffectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(f.labelSections.uses?.length).toBeGreaterThan(0);
  });

  it("uses the NDC form when one label covers tablets, caplets and gel caplets (Advil)", () => {
    const f = ok("advil-tablets-caplets-gel-caplets");
    expect(f.dosageForm).toBe("tablet");
    expect(strengths("advil-tablets-caplets-gel-caplets")).toEqual(["ibuprofen 200 mg per tablet"]);
    // every package of every product on the label
    const packages = fixtureProducts("advil-tablets-caplets-gel-caplets").flatMap((p) => p.packaging ?? []);
    expect(f.ndcPackages.length).toBe(packages.length);
  });

  it("keeps a liquid's per-volume strength (Children's Tylenol 160 mg per 5 mL)", () => {
    const f = ok("childrens-tylenol-suspension");
    expect(f.dosageForm).toBe("liquid");
    expect(strengths("childrens-tylenol-suspension")).toEqual(["acetaminophen 160 mg per 5 mL"]);
    expect(f.max24hText).toBe("do not give more than 5 times in 24 hours");
    expect(f.dosageTableHtml).toContain("<table>");
  });

  it("states a per-mL strength the way the label prints it when the label's number agrees (Claritin: 1 mg/mL → 5 mg per 5 mL)", () => {
    expect(strengths("claritin-solution-per-ml")).toEqual(["loratadine 5 mg per 5 mL"]);
  });

  it("takes the volume from the label when the NDC strength is per dose (Theraflu syrup: per 30 mL)", () => {
    expect(strengths("theraflu-syrup-count-strength")).toEqual([
      "acetaminophen 650 mg per 30 mL",
      "dextromethorphan 20 mg per 30 mL",
      "guaifenesin 400 mg per 30 mL",
      "phenylephrine 10 mg per 30 mL",
    ]);
  });

  it("orders multi-ingredient products as the label lists them (NyQuil Severe)", () => {
    const f = ok("nyquil-severe-caplet");
    expect(f.dosageForm).toBe("caplet");
    expect(strengths("nyquil-severe-caplet")).toEqual([
      "acetaminophen 325 mg per caplet",
      "dextromethorphan 10 mg per caplet",
      "doxylamine 6.25 mg per caplet",
      "phenylephrine 5 mg per caplet",
    ]);
    // L: the names as the label prints them; `normalized` is unchanged.
    expect(f.activeIngredients.map((i) => [i.name, i.normalized])).toEqual([
      ["Acetaminophen", "acetaminophen"],
      ["Dextromethorphan HBr", "dextromethorphan"],
      ["Doxylamine succinate", "doxylamine"],
      ["Phenylephrine HCl", "phenylephrine"],
    ]);
    expect(f.max24hText).toBe("do not exceed 8 caplets per 24 hrs");
    expect(f.warningsQuotes.length).toBeGreaterThan(0);
  });

  it("produces a row formulationToRow accepts, unreviewed", () => {
    const row = formulationToRow(ok("advil-liquigel"), null);
    expect(row.reviewed_at).toBeNull();
    expect(row.slug).toMatch(/^otc-/);
    expect(row.dosage_form).toBe("capsule");
  });
});

describe("mapLabel — strengths are the label's own (NDC values only confirm them)", () => {
  it("keeps the label's per-quantity when the NDC states the same strength per mL (Tukol: per 30 mL)", () => {
    expect(strengths("tukol-syrup-per-ml")).toEqual([
      "acetaminophen 650 mg per 30 mL",
      "dextromethorphan 20 mg per 30 mL",
      "doxylamine 12.5 mg per 30 mL",
    ]);
  });

  it("uses the label when the NDC value is wrong (200 mg/1201 typo; a whole-package 1.5 g/108.27 g)", () => {
    expect(strengths("ibuprofen-dye-free-ndc-typo")).toEqual(["ibuprofen 200 mg per capsule"]);
    expect(ok("soothe-chewable-package-strength").activeIngredients.map((i) => formatStrength(i.strength))).toEqual([
      "75 mg per chewable gel",
    ]);
  });

  it("names 'Ranitidine 75 mg (as ranitidine hydrochloride 84 mg)' by its leading name", () => {
    expect(ok("ranitidine-as-salt").activeIngredients).toEqual([
      { name: "Ranitidine", normalized: "ranitidine", strength: { amount: 75, unit: "mg", perAmount: 1, perUnit: "tablet" } },
    ]);
  });

  it.each<[FixtureName, string]>([
    ["fluoride-rinse-ion-basis", "strength_mismatch"], // label 0.05% sodium fluoride; NDC 0.2 mg/mL is the ion
    ["crest-rinse-ion-basis", "strength_mismatch"],
    ["listerine-toothpaste-smfp", "strength_mismatch"], // 0.76% SMFP vs NDC 1.3 mg/g (the ion)
    ["mineral-oil-percent", "strength_mismatch"], // 100% vs NDC 100 mg/100 mL
    ["jba-omelia-no-active-section", "strength_not_on_label"],
    ["placeholder-head-and-cold", "placeholder_label"],
  ])("%s → %s", (name, reason) => {
    expect(map(name)).toMatchObject({ ok: false, reason });
  });

  it("keeps the label's own per-unit: per fl oz, per dose", () => {
    const label = fixtureLabel("theraflu-syrup-count-strength");
    label.active_ingredient = ["Active ingredient (in each fl oz) Acetaminophen 650 mg Dextromethorphan HBr 20 mg Guaifenesin 400 mg Phenylephrine HCl 10 mg"];
    const r = mapOne(label, index);
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.formulation.activeIngredients.map((i) => formatStrength(i.strength))[0]).toBe("650 mg per fl oz");
  });

  it("converts a percent only when the basis is stated or the NDC confirms it", () => {
    const label = fixtureLabel("fluoride-rinse-ion-basis");
    label.active_ingredient = ["Active ingredient Sodium fluoride 0.02% w/v"];
    expect(mapOne(label, index)).toMatchObject({ ok: true });
    const r = mapOne(label, index);
    if (r.ok) expect(formatStrength(r.formulation.activeIngredients[0].strength)).toBe("0.2 mg per mL");
  });
});

describe("mapLabel — verifier findings (full-catalog scan)", () => {
  const rows = (name: FixtureName) => mapLabel(fixtureLabel(name), index);
  const summary = (name: FixtureName) =>
    rows(name).map((r) => (r.ok ? `${r.formulation.slug.replace(/^otc-[0-9a-f-]{36}/, "otc-…")} ${r.formulation.activeIngredients.map((i) => `${i.normalized} ${formatStrength(i.strength)}`).join(" + ")}` : r.reason));

  it("B: reads amounts after dot leaders at their real scale", () => {
    expect(strengths("nighttime-softgel-dot-leaders")).toEqual([
      "acetaminophen 325 mg per softgel",
      "dextromethorphan 15 mg per softgel",
      "doxylamine 6.25 mg per softgel",
    ]);
    expect(strengths("tussin-dm-dot-leaders")).toEqual(["dextromethorphan 10 mg per softgel", "guaifenesin 200 mg per softgel"]);
    expect(strengths("nicotine-gum-dot-leaders")).toEqual(["nicotine 4 mg per piece"]);
    expect(strengths("peg-3350-dot-leaders")).toEqual(["polyethylene glycol 17 g per dose"]);
  });

  it("C: keeps a per-dose quantity of several units (3 mini-tablets)", () => {
    expect(ok("mylanta-gas-minis-3-tablet-dose").activeIngredients).toEqual([
      expect.objectContaining({ name: "Simethicone", strength: { amount: 125, unit: "mg", perAmount: 3, perUnit: "chewable tablet" } }),
    ]);
  });

  it("D: takes the active amount, not the emulsion's", () => {
    expect(ok("mylanta-all-family-emulsion").activeIngredients.map((i) => `${i.name} ${formatStrength(i.strength)}`)).toEqual([
      "Calcium carbonate 800 mg per 10 mL",
      "Simethicone 80 mg per 10 mL",
    ]);
  });

  it("E: rejects an amount it can't read cleanly ('650 mgr') instead of borrowing a neighbour's", () => {
    expect(map("xl3-mgr-typo")).toMatchObject({ ok: false, reason: "strength_not_on_label" });
  });

  it("A: a label printing several strengths gives each NDC product's own (Zantac 10/20 mg → the 20 mg product)", () => {
    expect(summary("zantac-360-two-strengths-one-product")).toEqual(["otc-… famotidine 20 mg per tablet"]);
    expect(summary("allegra-60-180")).toEqual(["otc-… fexofenadine 180 mg per tablet"]);
    expect(summary("diphenhydramine-25-50")).toEqual(["otc-… diphenhydramine 50 mg per capsule"]);
    expect(summary("guaifenesin-pse-600-1200")).toEqual(["otc-… guaifenesin 600 mg per extended-release tablet + pseudoephedrine 60 mg per extended-release tablet"]);
    expect(summary("nicorette-lozenge-two-strengths")).toEqual(["otc-… nicotine 2 mg per lozenge"]);
  });

  it("A: package NDCs come only from the row's own NDC products", () => {
    const f = ok("zantac-360-two-strengths-one-product");
    const own = fixtureProducts("zantac-360-two-strengths-one-product").flatMap((p) => (p.packaging ?? []).map((k) => ndc11FromHyphenated(k.package_ndc!)));
    expect([...f.ndcPackages].sort()).toEqual([...new Set(own)].sort());
  });

  it("A: products of different strengths on one label become one row per strength, each with its own NDCs", () => {
    const label = fixtureLabel("nicotine-two-strengths");
    const out = mapLabel(label, index).filter((r) => r.ok).map((r) => (r.ok ? r.formulation : null)!);
    expect(out.map((f) => f.slug)).toEqual([`otc-${label.set_id}-2mg`, `otc-${label.set_id}-4mg`]);
    expect(out.map((f) => formatStrength(f.activeIngredients[0].strength))).toEqual(["2 mg per lozenge", "4 mg per lozenge"]);
    const [a, b] = out.map((f) => new Set(f.ndcPackages));
    expect([...a].some((n) => b.has(n))).toBe(false);
  });
});

describe("reviewedEnrichment — card text for a hand-checked row", () => {
  it("fills only sections, labeler, sources and a missing 24-hour limit from the row's label", () => {
    const label = fixtureLabel("tylenol-extra-strength-caplet");
    const e = reviewedEnrichment(label, index, { ingredientNames: ["Acetaminophen"], max24hText: null });
    expect(Object.keys(e).sort()).toEqual(["label_sections", "labeler_name", "max_24h_text", "source_links"]);
    expect(e.labeler_name).toBe("Kenvue Brands LLC");
    expect(e.source_links).toEqual([{ label: "FDA label (DailyMed)", url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${label.set_id}` }]);
    expect((e.label_sections as Record<string, string[]>).uses?.length).toBeGreaterThan(0);
    expect(e.max_24h_text).toBeTruthy();
  });

  it("keeps the row's own 24-hour limit", () => {
    const e = reviewedEnrichment(fixtureLabel("tylenol-extra-strength-caplet"), index, { ingredientNames: ["Acetaminophen"], max24hText: "as checked" });
    expect("max_24h_text" in e).toBe(false);
  });
});

describe("plausibleStrength", () => {
  it("rejects per-amounts no label uses", () => {
    expect(plausibleStrength({ amount: 200, unit: "mg", perAmount: 1201, perUnit: "capsule" })).toBe(false);
    expect(plausibleStrength({ amount: 200, unit: "mg", perAmount: 2, perUnit: "capsule" })).toBe(true);
    expect(plausibleStrength({ amount: 160, unit: "mg", perAmount: 5, perUnit: "mL" })).toBe(true);
    expect(plausibleStrength({ amount: 1, unit: "mg", perAmount: 500, perUnit: "mL" })).toBe(false);
    expect(plausibleStrength({ amount: 1.5, unit: "g", perAmount: 108.27, perUnit: "g" })).toBe(false);
  });
});

describe("mapLabel — rejects, with a reason", () => {
  it.each<[FixtureName, string]>([
    ["homeopathic-pellets", "homeopathic"],
    ["dayquil-nyquil-kit", "kit_or_multi_product"],
    ["fenbendazole-mg-per-mol", "unknown_unit"],
  ])("%s → %s", (name, reason) => {
    expect(map(name)).toMatchObject({ ok: false, reason });
  });

  it("rejects products that aren't finished", () => {
    const products = fixtureProducts("advil-liquigel").map((p) => ({ ...p, finished: false }));
    expect(mapOne(fixtureLabel("advil-liquigel"), indexNdcProducts(products))).toMatchObject({ ok: false, reason: "not_finished" });
  });

  it("rejects a route outside oral, sublingual and buccal", () => {
    const label = fixtureLabel("advil-liquigel");
    label.openfda = { ...label.openfda, route: ["TOPICAL"] };
    expect(mapOne(label, index)).toMatchObject({ ok: false, reason: "route" });
  });

  it("rejects a count strength on a liquid when the label gives no volume", () => {
    const label = fixtureLabel("theraflu-syrup-count-strength");
    label.active_ingredient = label.active_ingredient!.map((t) => t.replace(/\(in each 30 mL\)/, ""));
    expect(mapOne(label, index)).toMatchObject({ ok: false, reason: "unclear_per_unit" });
  });

  it("without an NDC join, reads strengths from the label text, else rejects", () => {
    const empty = indexNdcProducts([]);
    const fromLabel = mapOne(fixtureLabel("tylenol-extra-strength-caplet"), empty);
    expect(fromLabel).toMatchObject({ ok: true, join: "none" });
    if (fromLabel.ok) expect(fromLabel.formulation.activeIngredients.map((i) => formatStrength(i.strength))).toEqual(["500 mg per caplet"]);

    const label = fixtureLabel("tylenol-extra-strength-caplet");
    label.active_ingredient = ["Active ingredient Acetaminophen"];
    expect(mapOne(label, empty)).toMatchObject({ ok: false, reason: "no_join_no_strength" });
  });
});

describe("importLabels", () => {
  const labels = allFixtureNames().map(fixtureLabel);

  it("counts rows, rejects by reason and join methods", () => {
    const result = importLabels(labels, index, new Set());
    // A label gives one row per strength set, so rows + rejects can exceed the label count.
    expect(result.rows.length + Object.values(result.rejects).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(labels.length);
    expect(result.rejects.homeopathic).toBe(1);
    expect(result.joins.spl_id).toBe(labels.length);
    expect(new Set(result.rows.map((r) => r.slug)).size).toBe(result.rows.length);
  });

  it("skips a label whose package NDC is already on a hand-checked row — reviewed rows win", () => {
    const tylenol = ok("tylenol-extra-strength-caplet");
    const result = importLabels(labels, index, new Set([tylenol.ndcPackages[0]]));
    expect(result.rejects.reviewed_ndc).toBe(1);
    expect(result.rows.map((r) => r.slug)).not.toContain(tylenol.slug);
    expect(result.skippedForReviewed.map((r) => r.slug)).toEqual([tylenol.slug]);
  });
});
