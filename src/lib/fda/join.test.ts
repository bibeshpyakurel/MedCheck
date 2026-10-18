import { describe, expect, it } from "vitest";
import { allFixtureProducts, fixtureLabel, fixtureProducts } from "./__fixtures__";
import { indexNdcProducts, joinLabel } from "./join";

describe("joinLabel — FDA label ↔ NDC Directory products", () => {
  const index = indexNdcProducts(allFixtureProducts());

  it("joins on the label's SPL id (label `id` = NDC `spl_id`)", () => {
    const advil = joinLabel(fixtureLabel("advil-tablets-caplets-gel-caplets"), index);
    expect(advil.method).toBe("spl_id");
    expect(advil.products.map((p) => p.product_ndc).sort()).toEqual(
      fixtureProducts("advil-tablets-caplets-gel-caplets").map((p) => p.product_ndc).sort(),
    );

    const childrens = joinLabel(fixtureLabel("childrens-advil-suspension"), index);
    expect(childrens.method).toBe("spl_id");
    expect(childrens.products).toHaveLength(6);

    const tylenol = joinLabel(fixtureLabel("tylenol-extra-strength-tablet"), index);
    expect(tylenol.products.map((p) => p.brand_name)).toEqual(["TYLENOL Extra Strength"]);
  });

  it("falls back to overlapping package NDCs when the SPL id doesn't match", () => {
    const products = fixtureProducts("tylenol-extra-strength-tablet").map((p) => ({ ...p, spl_id: "an-older-spl-version" }));
    const joined = joinLabel(fixtureLabel("tylenol-extra-strength-tablet"), indexNdcProducts(products));
    expect(joined.method).toBe("package_ndc");
    expect(joined.products).toHaveLength(1);
  });

  it("reports no join when nothing matches", () => {
    const joined = joinLabel(fixtureLabel("tylenol-extra-strength-tablet"), indexNdcProducts([]));
    expect(joined).toEqual({ method: "none", products: [] });
  });
});
