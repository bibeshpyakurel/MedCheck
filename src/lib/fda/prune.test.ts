import { describe, expect, it } from "vitest";
import { planPrune } from "./prune";

describe("planPrune", () => {
  const existing = [
    { id: "1", slug: "otc-a", source: "openfda", reviewed_at: null },
    { id: "2", slug: "otc-b", source: "openfda", reviewed_at: null }, // no longer produced
    { id: "3", slug: "otc-c", source: "openfda", reviewed_at: null }, // no longer produced, but a saved entry uses it
    { id: "4", slug: "tylenol-extra-strength-500mg-caplet", source: "openfda", reviewed_at: "2026-10-17T00:00:00Z" },
    { id: "5", slug: "otc-d", source: "openfda", reviewed_at: "2026-10-17T00:00:00Z" }, // hand-checked: never pruned
    { id: "6", slug: "calmora-a", source: "fictional", reviewed_at: null },
  ];

  it("deletes only unreviewed imported otc- rows this run didn't produce, keeping referenced ones", () => {
    const plan = planPrune(existing, new Set(["otc-a"]), new Set(["3"]));
    expect(plan.remove.map((r) => r.slug)).toEqual(["otc-b"]);
    expect(plan.keptReferenced.map((r) => r.slug)).toEqual(["otc-c"]);
  });
});
