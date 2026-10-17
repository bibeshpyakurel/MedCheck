import { describe, expect, it } from "vitest";
import type { CheckId, CheckRun, CheckStatus, Finding } from "@/lib/domain/schema";
import { calmoraA, calmoraADraft, ibuprofen, input, nyquilBarcode, prescriptionStrengthPending } from "./__fixtures__/entries";
import { runChecks } from "./index";
import { INCOMPLETE_LINE, NONE_FOUND_LINE, NOTHING_TO_COMPARE_LINE, warningsView } from "./warnings";

const run = (check: CheckId, status: CheckStatus, extra: Partial<CheckRun> = {}): CheckRun => ({
  check,
  status,
  summary: "",
  reasons: [],
  findings: [],
  ...extra,
});

const finding = (id: string, title = id): Finding => ({
  id,
  check: "ingredient_overlap",
  entryIds: [],
  title,
  detail: "",
  evidence: [],
  labelWarningQuote: null,
  pharmacistQuestion: "",
});

describe("warningsView", () => {
  it("lists every finding as a warning, in check order, once each", () => {
    const a = finding("a");
    const b = finding("b");
    const view = warningsView([
      run("ingredient_overlap", "finding", { findings: [a] }),
      run("units", "no_finding"),
      run("concentration", "finding", { findings: [b, a] }),
    ]);
    expect(view.warnings.map((w) => w.id)).toEqual(["a", "b"]);
    expect(view.emptyLine).toBeNull();
    expect(view.incompleteLine).toBeNull();
  });

  it("says nothing was found only in the details the user confirmed — never safe, never all clear", () => {
    const view = warningsView([run("ingredient_overlap", "no_finding"), run("units", "not_applicable")]);
    expect(view.warnings).toEqual([]);
    expect(view.emptyLine).toBe(NONE_FOUND_LINE);
    expect(NONE_FOUND_LINE).toBe("No shared ingredients or other warnings found in the details you confirmed.");
  });

  it("doesn't claim a comparison when nothing could be compared", () => {
    expect(warningsView([run("ingredient_overlap", "not_applicable")]).emptyLine).toBe(NOTHING_TO_COMPARE_LINE);
  });

  it("summarizes checks that couldn't finish in one plain line, beside findings or alone", () => {
    const withFinding = warningsView([
      run("ingredient_overlap", "finding", { findings: [finding("a")] }),
      run("concentration", "unresolved", { reasons: ["x"] }),
    ]);
    expect(withFinding.incompleteLine).toBe(INCOMPLETE_LINE);

    // A check that found something but skipped an entry still couldn't compare everything.
    const skipped = warningsView([run("ingredient_overlap", "finding", { findings: [finding("a")], reasons: ["y"] })]);
    expect(skipped.incompleteLine).toBe(INCOMPLETE_LINE);

    const alone = warningsView([run("units", "unresolved", { reasons: ["x"] }), run("concentration", "not_applicable", { reasons: ["z"] })]);
    expect(alone.warnings).toEqual([]);
    expect(alone.incompleteLine).toBe(INCOMPLETE_LINE);
    // Unfinished is not a clean result: no "none found" line unless something was actually compared.
    expect(alone.emptyLine).toBeNull();

    const partly = warningsView([run("units", "unresolved", { reasons: ["x"] }), run("ingredient_overlap", "no_finding")]);
    expect(partly.emptyLine).toBe(NONE_FOUND_LINE);
    expect(partly.incompleteLine).toBe(INCOMPLETE_LINE);
  });

  it("ignores reasons on checks that had nothing to compare", () => {
    expect(warningsView([run("units", "not_applicable", { reasons: ["Nothing"] })]).incompleteLine).toBeNull();
  });

  it("never uses the words safe or clear", () => {
    const text = [NONE_FOUND_LINE, NOTHING_TO_COMPARE_LINE, INCOMPLETE_LINE].join(" ").toLowerCase();
    expect(text).not.toMatch(/safe|clear/);
  });

  it("works on real check runs: overlap is a warning, drafts and pending details are not", () => {
    const overlap = warningsView(runChecks(input(nyquilBarcode, calmoraA)));
    expect(overlap.warnings.map((w) => w.check)).toContain("ingredient_overlap");

    const none = warningsView(runChecks(input(ibuprofen, calmoraA, calmoraADraft)));
    expect(none.warnings).toEqual([]);
    expect(none.emptyLine).toBe(NONE_FOUND_LINE);

    const pending = warningsView(runChecks(input(calmoraA, prescriptionStrengthPending)));
    expect(pending.incompleteLine).toBe(INCOMPLETE_LINE);
  });
});
