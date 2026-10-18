import { describe, expect, it } from "vitest";
import { fixtureLabel, fixtureProducts } from "./__fixtures__";
import { labelPers, parseNdcStrength } from "./strength";

const strengthOf = (name: Parameters<typeof fixtureProducts>[0]) => fixtureProducts(name)[0].active_ingredients![0].strength!;

describe("parseNdcStrength", () => {
  it("reads a per-unit solid strength (Advil: 200 mg/1)", () => {
    expect(parseNdcStrength(strengthOf("advil-tablets-caplets-gel-caplets"))).toEqual({
      ok: true,
      value: { amount: 200, unit: "mg", per: { kind: "count", amount: 1 } },
    });
  });

  it("reads a per-volume liquid strength (Children's Tylenol: 160 mg/5mL)", () => {
    expect(parseNdcStrength(strengthOf("childrens-tylenol-suspension"))).toEqual({
      ok: true,
      value: { amount: 160, unit: "mg", per: { kind: "measure", amount: 5, unit: "mL" } },
    });
  });

  it("reads a bare per-mL strength as per 1 mL (Claritin solution: 1 mg/mL)", () => {
    expect(parseNdcStrength(strengthOf("claritin-solution-per-ml"))).toEqual({
      ok: true,
      value: { amount: 1, unit: "mg", per: { kind: "measure", amount: 1, unit: "mL" } },
    });
  });

  it("maps NDC spellings onto the contract's units", () => {
    expect(parseNdcStrength("50 ug/1")).toMatchObject({ ok: true, value: { amount: 50, unit: "mcg" } });
    expect(parseNdcStrength("0.15 g/100g")).toMatchObject({
      ok: true,
      value: { amount: 0.15, unit: "g", per: { kind: "measure", amount: 100, unit: "g" } },
    });
    expect(parseNdcStrength("400 [USP'U]/1")).toMatchObject({ ok: true, value: { amount: 400, unit: "unit" } });
  });

  it("rejects units outside the contract instead of guessing (Fenbendazole: mg/mol)", () => {
    expect(parseNdcStrength(strengthOf("fenbendazole-mg-per-mol"))).toEqual({ ok: false, reason: "unknown_unit" });
    expect(parseNdcStrength("10 meq/mL")).toEqual({ ok: false, reason: "unknown_unit" });
    expect(parseNdcStrength("30 [hp_C]/1")).toEqual({ ok: false, reason: "unknown_unit" });
  });

  it("calls an empty or malformed strength unreadable", () => {
    expect(parseNdcStrength("")).toEqual({ ok: false, reason: "unreadable" });
    expect(parseNdcStrength("see label")).toEqual({ ok: false, reason: "unreadable" });
  });
});

describe("labelPers — the label's own '(in each …)' wording", () => {
  const text = (name: Parameters<typeof fixtureLabel>[0]) => fixtureLabel(name).active_ingredient!.join(" ");

  it("reads a count noun", () => {
    expect(labelPers(text("tylenol-extra-strength-caplet"))).toEqual([{ kind: "count", noun: "caplet" }]);
    expect(labelPers(text("advil-liquigel"))).toEqual([{ kind: "count", noun: "capsule" }]);
  });

  it("reads a volume, ignoring the teaspoon note after it", () => {
    expect(labelPers(text("childrens-tylenol-suspension"))).toEqual([{ kind: "volume", amount: 5 }]);
    expect(labelPers(text("claritin-solution-per-ml"))).toEqual([{ kind: "volume", amount: 5 }]);
    expect(labelPers(text("theraflu-syrup-count-strength"))).toEqual([{ kind: "volume", amount: 30 }]);
  });

  it("lists each distinct wording once when a label covers several products (Advil)", () => {
    expect(labelPers(text("advil-tablets-caplets-gel-caplets"))).toEqual([
      { kind: "count", noun: "tablet" },
      { kind: "count", noun: "caplet" },
      { kind: "count", noun: "gel caplet" },
    ]);
  });
});
