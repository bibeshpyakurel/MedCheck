import { describe, expect, it } from "vitest";
import type { CheckId, CheckRun, CheckStatus } from "@/lib/domain/schema";
import { checksSummaryParts } from "./summary";

const run = (check: CheckId, status: CheckStatus): CheckRun => ({ check, status, summary: "", reasons: [], findings: [] });

describe("checksSummaryParts", () => {
  it("separates checks that compared something from ones with nothing to compare", () => {
    const runs = [
      run("ingredient_overlap", "finding"),
      run("repeated_record", "no_finding"),
      run("concentration", "not_applicable"),
      run("units", "no_finding"),
      run("database_vs_box", "unresolved"),
    ];
    expect(checksSummaryParts(runs)).toEqual([
      "3 of 5 checks compared confirmed values",
      "1 found something",
      "1 couldn't be completed",
      "1 had nothing to compare",
    ]);
  });

  it("never says checks ran when there was nothing to compare (one medicine on file)", () => {
    const ids = ["ingredient_overlap", "repeated_record", "concentration", "units", "database_vs_box"] as const;
    const runs = ids.map((c) => run(c, "not_applicable"));
    expect(checksSummaryParts(runs)).toEqual(["None of the 5 checks could compare confirmed values yet", "5 had nothing to compare"]);
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
