import { describe, expect, it } from "vitest";
import type { CheckId, CheckRun, CheckStatus, Finding } from "@/lib/domain/schema";
import { attentionSummary, checksSummaryParts } from "./summary";

const run = (check: CheckId, status: CheckStatus): CheckRun => ({ check, status, summary: "", reasons: [], findings: [] });

const finding = (title: string, question: string): Finding => ({
  id: title,
  check: "ingredient_overlap",
  entryIds: [],
  title,
  detail: "",
  evidence: [],
  labelWarningQuote: null,
  pharmacistQuestion: question,
});
const found = (check: CheckId, ...findings: Finding[]): CheckRun => ({ ...run(check, "finding"), findings });
const unresolved = (check: CheckId, ...reasons: string[]): CheckRun => ({ ...run(check, "unresolved"), reasons });

describe("checksSummaryParts", () => {
  it("separates checks that compared something from ones with nothing to compare", () => {
    const runs = [
      run("ingredient_overlap", "finding"),
      run("repeated_record", "no_finding"),
      run("concentration", "not_applicable"),
      run("units", "no_finding"),
      run("document_vs_bottle", "unresolved"),
      run("database_vs_box", "not_applicable"),
    ];
    expect(checksSummaryParts(runs)).toEqual([
      "3 of 6 checks compared confirmed values",
      "1 found something",
      "1 couldn't be completed",
      "2 had nothing to compare",
    ]);
  });

  it("never says checks ran when there was nothing to compare (one medicine on file)", () => {
    const ids = ["ingredient_overlap", "repeated_record", "concentration", "units", "document_vs_bottle", "database_vs_box"] as const;
    const runs = ids.map((c) => run(c, "not_applicable"));
    expect(checksSummaryParts(runs)).toEqual(["None of the 6 checks could compare confirmed values yet", "6 had nothing to compare"]);
  });

  it("keeps couldn't-be-completed apart from nothing-to-compare", () => {
    expect(checksSummaryParts([run("units", "unresolved"), run("concentration", "not_applicable")])).toEqual([
      "None of the 2 checks could compare confirmed values yet",
      "1 couldn't be completed",
      "1 had nothing to compare",
    ]);
  });

  it("omits empty groups but always says how many found something once anything was compared", () => {
    expect(checksSummaryParts([run("units", "no_finding"), run("repeated_record", "no_finding")])).toEqual([
      "2 of 2 checks compared confirmed values",
      "0 found something",
    ]);
  });

  it("never uses the word safe", () => {
    const all = (["finding", "no_finding", "unresolved", "not_applicable"] as const).map((s) => run("units", s));
    expect(checksSummaryParts(all).join(" ").toLowerCase()).not.toContain("safe");
  });
});

describe("attentionSummary", () => {
  it("counts each distinct pharmacist question and leads with the first finding", () => {
    const runs = [
      found("ingredient_overlap", finding("Two medicines list Acetaminophen", "Q1")),
      found("concentration", finding("These liquids have different strengths of Acetaminophen", "Q2"), finding("Same question again", "Q1")),
      run("units", "no_finding"),
    ];
    expect(attentionSummary(runs)).toEqual({
      tone: "finding",
      headline: "2 things to ask a pharmacist",
      lead: "Two medicines list Acetaminophen",
      needsDetails: null,
    });
  });

  it("keeps unfinished checks visible beside findings, never folded into them", () => {
    const runs = [found("units", finding("The amount and strength use different units: X", "Q")), unresolved("concentration", "a", "b")];
    expect(attentionSummary(runs)).toMatchObject({ headline: "1 thing to ask a pharmacist", needsDetails: "1 check needs more details" });
    expect(attentionSummary([unresolved("units", "a"), unresolved("concentration", "b")])).toEqual({
      tone: "unresolved",
      headline: "No findings in confirmed fields",
      lead: null,
      needsDetails: "2 checks need more details",
    });
  });

  it("says nothing was found only in confirmed fields, and never 'all clear' when nothing was compared", () => {
    expect(attentionSummary([run("units", "no_finding"), run("concentration", "not_applicable")])).toEqual({
      tone: "neutral",
      headline: "No findings in confirmed fields",
      lead: null,
      needsDetails: null,
    });
    expect(attentionSummary([run("units", "not_applicable")]).headline).toBe("Nothing to compare yet");
  });

  it("never uses the words safe or clear", () => {
    const text = JSON.stringify([
      attentionSummary([run("units", "no_finding")]),
      attentionSummary([run("units", "not_applicable")]),
    ]).toLowerCase();
    expect(text).not.toMatch(/safe|clear/);
  });
});
