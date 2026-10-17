import { describe, expect, it } from "vitest";
import { formatStrength } from "@/lib/domain/fields";
import childrens from "./__fixtures__/openfda-childrens-tylenol-160mg-5ml.json";
import kit from "./__fixtures__/openfda-dayquil-nyquil-kit.json";
import homeopathic from "./__fixtures__/openfda-homeopathic.json";
import nyquil from "./__fixtures__/openfda-nyquil-37000-523-02.json";
import { labelToFormulation, ndcSearchQuery, sanitizeDosageTable, type OpenFdaLabel } from "./openfda";

const NYQUIL = nyquil as OpenFdaLabel;
const CHILDRENS = childrens as OpenFdaLabel;

describe("labelToFormulation — NyQuil Severe Cold & Flu caplets (37000-523-02)", () => {
  const f = labelToFormulation(NYQUIL)!;

  it("maps the label", () => {
    expect(f).not.toBeNull();
    expect(f.brandName).toBe("NyQuil Severe plus Vicks VapoCool Cold and Flu");
    expect(f.genericName).toBe(
      "Acetaminophen, phenylephrine hydrochloride, doxylamine succinate, and dextromethorphan hydrobromide",
    );
    expect(f.dosageForm).toBe("caplet");
    expect(f.isFictional).toBe(false);
    expect(f.source).toBe("openfda");
    expect(f.openfdaSetId).toBe("724d0889-5ba5-3125-e053-2a91aa0a92c1");
    expect(f.labelEffectiveDate).toBe("2025-10-01");
    expect(f.ndcPackages).toEqual(["37000052302"]);
    expect(f.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("extracts every active ingredient with its per-caplet strength, in label order", () => {
    expect(f.activeIngredients.map((i) => [i.name, i.normalized, formatStrength(i.strength)])).toEqual([
      ["Acetaminophen", "acetaminophen", "325 mg per caplet"],
      ["Dextromethorphan HBr", "dextromethorphan", "10 mg per caplet"],
      ["Doxylamine succinate", "doxylamine", "6.25 mg per caplet"],
      ["Phenylephrine HCl", "phenylephrine", "5 mg per caplet"],
    ]);
    expect(f.activeIngredients[0].strength).toEqual({ amount: 325, unit: "mg", perAmount: 1, perUnit: "caplet" });
  });

  it("keeps the directions text and the 24-hour maximum sentence verbatim", () => {
    expect(f.directionsText).toMatch(/^take only as directed/);
    expect(f.directionsText).toContain("2 caplets with water every 4 hrs");
    expect(f.max24hText).toBe("do not exceed 8 caplets per 24 hrs");
  });

  it("quotes the label's acetaminophen warnings", () => {
    expect(f.warningsQuotes.length).toBeGreaterThan(0);
    for (const q of f.warningsQuotes) expect(q.toLowerCase()).toContain("acetaminophen");
    expect(f.warningsQuotes).toContain(
      "Do not use with any other drug containing acetaminophen (prescription or nonprescription).",
    );
    expect(f.warningsQuotes).toContain("Liver warning: This product contains acetaminophen.");
  });

  it("keeps the dosing table, sanitized", () => {
    expect(f.dosageTableHtml).toContain("<table>");
    expect(f.dosageTableHtml).toContain("2 caplets with water every 4 hrs");
    expect(f.dosageTableHtml).toContain("children under 4 yrs");
    expect(f.dosageTableHtml).not.toMatch(/border=|width=/);
  });
});

describe("labelToFormulation — Children's Tylenol 160 mg per 5 mL", () => {
  const f = labelToFormulation(CHILDRENS)!;

  it("reads the strength per 5 mL and calls it a liquid", () => {
    expect(f.dosageForm).toBe("liquid");
    expect(f.activeIngredients).toEqual([
      {
        name: "Acetaminophen",
        normalized: "acetaminophen",
        strength: { amount: 160, unit: "mg", perAmount: 5, perUnit: "mL" },
      },
    ]);
    expect(formatStrength(f.activeIngredients[0].strength)).toBe("160 mg per 5 mL");
    expect(f.ndcPackages).toEqual(["50580013904", "50580013908"]);
  });

  it("finds the 24-hour maximum among the bullets", () => {
    expect(f.max24hText).toBe("do not give more than 5 times in 24 hours");
    expect(f.directionsText).toMatch(/^this product does not contain directions or complete warnings for adult use/);
    expect(f.directionsText).not.toContain("■");
  });

  it("quotes warnings containing acetaminophen, including the do-not-use line", () => {
    for (const q of f.warningsQuotes) expect(q.toLowerCase()).toContain("acetaminophen");
    expect(f.warningsQuotes).toContain(
      "Do not use with any other drug containing acetaminophen (prescription or nonprescription).",
    );
  });

  it("keeps every row of the weight/age table and drops SPL markup", () => {
    const html = f.dosageTableHtml!;
    expect(html.match(/<tr>/g)).toHaveLength(7);
    for (const cell of ["Weight (lb)", "under 24", "24-35 lbs", "36-47 lbs", "48-59 lbs", "60-71 lbs", "72-95 lbs", "15 mL"]) {
      expect(html).toContain(cell);
    }
    expect(html).not.toMatch(/styleCode|<content|<paragraph/);
  });
});

describe("labelToFormulation — rejects", () => {
  it("homeopathic labels", () => {
    expect(labelToFormulation(homeopathic as OpenFdaLabel)).toBeNull();
  });

  it("non-oral labels", () => {
    expect(labelToFormulation({ ...NYQUIL, openfda: { ...NYQUIL.openfda, route: ["TOPICAL"] } })).toBeNull();
    expect(labelToFormulation({ ...NYQUIL, openfda: { ...NYQUIL.openfda, route: undefined } })).toBeNull();
  });

  it("prescription labels", () => {
    expect(
      labelToFormulation({ ...NYQUIL, openfda: { ...NYQUIL.openfda, product_type: ["HUMAN PRESCRIPTION DRUG"] } }),
    ).toBeNull();
  });

  it("kits with more than one product (e.g. a DayQuil + NyQuil pack)", () => {
    expect(labelToFormulation(kit as OpenFdaLabel)).toBeNull();
  });

  it("labels whose strengths can't be read", () => {
    expect(labelToFormulation({ ...NYQUIL, active_ingredient: ["Active ingredients: see package"] })).toBeNull();
  });
});

describe("sanitizeDosageTable", () => {
  it("keeps table structure and spans, drops scripts, handlers and styling", () => {
    const html = sanitizeDosageTable(
      '<table border="1" style="color:red"><tr><td colspan="2" onclick="x()">a<script>alert(1)</script></td></tr></table><img src=x onerror=alert(1)>',
    );
    expect(html).toBe('<table><tbody><tr><td colspan="2">a</td></tr></tbody></table>');
  });

  it("keeps several SPL paragraphs in one cell on separate lines", () => {
    const html = sanitizeDosageTable(
      "<table><tr><td><paragraph>take 2 caplets every 6 hours</paragraph><paragraph>do not take more than 6 caplets in 24 hours</paragraph></td></tr></table>",
    );
    expect(html).toContain("take 2 caplets every 6 hours<br>do not take more than 6 caplets in 24 hours");
  });
});

describe("ndcSearchQuery", () => {
  it("ORs every hyphenated candidate against openfda.package_ndc", () => {
    expect(ndcSearchQuery(["3700-0523-02", "37000-523-02"])).toBe(
      'openfda.package_ndc:"3700-0523-02" OR openfda.package_ndc:"37000-523-02"',
    );
  });

  it("also searches openfda.upc for a scanned UPC", () => {
    expect(ndcSearchQuery(["0045-0449-10"], "0300450449108")).toBe(
      'openfda.package_ndc:"0045-0449-10" OR openfda.upc:"0300450449108"',
    );
    expect(ndcSearchQuery([], "0036000291452")).toBe('openfda.upc:"0036000291452"');
  });
});
