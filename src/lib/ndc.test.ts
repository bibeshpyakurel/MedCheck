import { describe, expect, it } from "vitest";
import { FICTIONAL_FORMULATIONS } from "@/data/fictional-formulations";
import { gs1CheckDigit, ndc11FromHyphenated, ndc11Candidates, ndcHyphenatedCandidates, parseBarcode } from "./ndc";

describe("parseBarcode", () => {
  it("decodes a UPC-A: '3' + 10-digit NDC + check digit", () => {
    expect(parseBarcode("399999100052")).toBe("9999910005");
    expect(parseBarcode("337000523025")).toBe("3700052302");
  });

  it("decodes every fictional demo barcode to its NDC", () => {
    for (const f of FICTIONAL_FORMULATIONS) expect(parseBarcode(f.upcA)).toBe(f.ndc10);
  });

  it("rejects a UPC-A with a wrong check digit", () => {
    expect(parseBarcode("399999100053")).toBeNull();
    expect(parseBarcode("337000523024")).toBeNull();
  });

  it("rejects a valid UPC-A that is not a drug code (does not start with 3)", () => {
    // 036000291452 is a valid grocery UPC-A.
    expect(parseBarcode("036000291452")).toBeNull();
  });

  it("accepts a UPC-A read as EAN-13 (leading 0)", () => {
    expect(parseBarcode("0337000523025")).toBe("3700052302");
  });

  it("decodes GTIN-14 from a GS1 DataMatrix, with or without parentheses", () => {
    expect(parseBarcode("(01)00337000523025(17)271231(10)AB12")).toBe("3700052302");
    expect(parseBarcode("0100337000523025172712311" + "0AB12")).toBe("3700052302");
    expect(parseBarcode("\u001d0100337000523025\u001d10AB12")).toBe("3700052302");
    expect(parseBarcode("00337000523025")).toBe("3700052302");
    // Packaging indicator digit 1, check digit recomputed.
    expect(parseBarcode("(01)10337000523022")).toBe("3700052302");
  });

  it("rejects a GTIN-14 with a bad check digit or a non-drug prefix", () => {
    expect(parseBarcode("(01)00337000523026")).toBeNull();
    expect(parseBarcode("(01)00036000291452")).toBeNull();
  });

  it("accepts a typed NDC with or without hyphens", () => {
    expect(parseBarcode("37000-523-02")).toBe("3700052302");
    expect(parseBarcode(" 37000-523-02 ")).toBe("3700052302");
    expect(parseBarcode("3700-0523-02")).toBe("3700052302");
    expect(parseBarcode("37000-5230-2")).toBe("3700052302");
    expect(parseBarcode("3700052302")).toBe("3700052302");
    expect(parseBarcode("NDC 37000-523-02")).toBe("3700052302");
  });

  it("rejects hyphenated codes that are not a 4-4-2, 5-3-2 or 5-4-1 layout", () => {
    expect(parseBarcode("370-00523-02")).toBeNull();
    expect(parseBarcode("37000-52-302")).toBeNull();
  });

  it("rejects junk", () => {
    expect(parseBarcode("")).toBeNull();
    expect(parseBarcode("hello")).toBeNull();
    expect(parseBarcode("12345")).toBeNull();
    expect(parseBarcode("https://example.com")).toBeNull();
  });
});

describe("ndc11Candidates", () => {
  it("expands a 10-digit NDC to the 11-digit form of all three layouts", () => {
    // 4-4-2 → 0 + …; 5-3-2 → 5-0+3-2; 5-4-1 → 5-4-0+1
    expect(ndc11Candidates("9999910005")).toEqual(["09999910005", "99999010005", "99999100005"]);
    expect(ndc11Candidates("3700052302")).toEqual(["03700052302", "37000052302", "37000523002"]);
  });

  it("includes each fictional product's catalog NDC", () => {
    for (const f of FICTIONAL_FORMULATIONS) expect(ndc11Candidates(f.ndc10)).toContain(f.ndcPackages[0]);
  });

  it("returns nothing for a malformed input", () => {
    expect(ndc11Candidates("123")).toEqual([]);
  });
});

describe("ndcHyphenatedCandidates", () => {
  it("lists the 4-4-2, 5-3-2 and 5-4-1 hyphenations", () => {
    expect(ndcHyphenatedCandidates("3700052302")).toEqual(["3700-0523-02", "37000-523-02", "37000-5230-2"]);
  });
});

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

describe("gs1CheckDigit", () => {
  it("matches known codes", () => {
    expect(gs1CheckDigit("33700052302")).toBe(5);
    expect(gs1CheckDigit("1033700052302")).toBe(2);
  });
});
