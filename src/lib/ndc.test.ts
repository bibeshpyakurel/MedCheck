import { describe, expect, it } from "vitest";
import { ndc11FromHyphenated } from "./ndc";

describe("ndc11FromHyphenated", () => {
  it("pads the short segment to 5-4-2", () => {
    expect(ndc11FromHyphenated("37000-523-02")).toBe("37000052302");
    expect(ndc11FromHyphenated("0363-0323-24")).toBe("00363032324");
    expect(ndc11FromHyphenated("85237-1955-0")).toBe("85237195500");
    expect(ndc11FromHyphenated("50580-0139-04")).toBe("50580013904");
  });

  it("returns null for anything else", () => {
    expect(ndc11FromHyphenated("3700052302")).toBeNull();
    expect(ndc11FromHyphenated("1-2-3")).toBeNull();
  });
});
