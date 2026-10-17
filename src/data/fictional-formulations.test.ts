import { describe, expect, it } from "vitest";
import { FICTIONAL_FORMULATIONS, upcCheckDigit } from "./fictional-formulations";

describe("fictional formulations", () => {
  it.each(FICTIONAL_FORMULATIONS.map((f) => [f.slug, f] as const))("%s has a valid UPC-A for its NDC", (_, f) => {
    expect(f.upcA).toBe(`3${f.ndc10}${upcCheckDigit(`3${f.ndc10}`)}`);
    expect(f.ndc10).toHaveLength(10);
    expect(f.ndcPackages[0]).toHaveLength(11);
  });

  it("computes known check digits", () => {
    expect(upcCheckDigit("33700052302")).toBe(5);
  });
});
