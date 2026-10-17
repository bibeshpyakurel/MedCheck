import { describe, expect, it } from "vitest";
import { catalogLabelSource, catalogMatchLabel, formatDocDate, isSelf, recordTitle } from "./record-format";

describe("self profiles", () => {
  const me = { displayName: "Jamie", relationship: "self", notes: null };
  const sam = { displayName: "Sam", relationship: "son", notes: "Age 13" };

  it("recognizes the self profile", () => {
    expect(isSelf(me)).toBe(true);
    expect(isSelf({ relationship: "Myself" })).toBe(true);
    expect(isSelf(sam)).toBe(false);
    expect(isSelf({ relationship: null })).toBe(false);
  });

  it("titles the record", () => {
    expect(recordTitle(me)).toBe("My medicines");
    expect(recordTitle(sam)).toBe("Sam's medicines");
  });
});

describe("formatDocDate", () => {
  it("formats a calendar date without shifting it", () => {
    expect(formatDocDate("2026-10-16")).toBe("Oct 16, 2026");
    expect(formatDocDate(null)).toBeNull();
  });
});

describe("catalog provenance", () => {
  const openfda = { isFictional: false, source: "openfda" as const, labelEffectiveDate: "2026-07-22" };
  const fictional = { isFictional: true, source: "fictional" as const, labelEffectiveDate: "2026-10-01" };

  it("names the FDA label only for openFDA products", () => {
    expect(catalogLabelSource(openfda)).toBe("FDA label (openFDA), effective 2026-07-22");
    expect(catalogLabelSource({ ...openfda, labelEffectiveDate: null })).toBe("FDA label (openFDA)");
  });

  it("never calls a fictional product an FDA label, even with an effective date", () => {
    expect(catalogLabelSource(fictional)).toBe("Fictional label (not a real product)");
    // Either flag alone is enough to keep "FDA" off a demo product.
    expect(catalogLabelSource({ ...fictional, source: "openfda" })).toBe("Fictional label (not a real product)");
    expect(catalogLabelSource({ ...openfda, source: "fictional" })).toBe("Fictional label (not a real product)");
  });

  it("says how the catalog match was made, by input method", () => {
    expect(catalogMatchLabel("barcode", "NyQuil Severe")).toBe("Barcode: NyQuil Severe");
    expect(catalogMatchLabel("picker", "Calmora Fever Relief (Bottle A)")).toBe("Picked from list: Calmora Fever Relief (Bottle A)");
    expect(catalogMatchLabel("photo", "Tylenol")).toBe("Catalog match: Tylenol");
  });
});
