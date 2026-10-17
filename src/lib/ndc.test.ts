import { describe, expect, it } from "vitest";
import { FICTIONAL_FORMULATIONS } from "@/data/fictional-formulations";
import {
  gs1CheckDigit,
  ndc11FromHyphenated,
  ndc11Candidates,
  ndcHyphenatedCandidates,
  ndcLookupKeys,
  parseBarcode,
} from "./ndc";

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

  it("accepts the spaces and dashes people type from a box or phone keyboard", () => {
    expect(parseBarcode("37000 523 02")).toBe("3700052302");
    expect(parseBarcode("37000–523–02")).toBe("3700052302"); // en dashes
    expect(parseBarcode("3 37000 52302 5")).toBe("3700052302"); // UPC-A as printed under the bars
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

describe("ndcLookupKeys", () => {
  it("keeps the scan screen's example NDC resolvable to the seeded NyQuil package", () => {
    const keys = ndcLookupKeys("37000-523-02");
    expect(keys?.ndc11).toContain("37000052302");
    expect(keys?.hyphenated).toContain("37000-523-02");
    expect(keys?.upc).toBeNull();
  });

  it("keeps the UPC of a UPC-A, as openFDA's 13-digit `upc` field stores it", () => {
    // Real Tylenol Extra Strength box: the UPC carries McNeil's legacy labeler 0045, but the
    // label's NDCs are 50580-…, so only the UPC finds it.
    expect(ndcLookupKeys("300450449108")).toEqual({
      ndc11: ndc11Candidates("0045044910"),
      hyphenated: ndcHyphenatedCandidates("0045044910"),
      upc: "0300450449108",
    });
    expect(ndcLookupKeys("0300450449108")?.upc).toBe("0300450449108"); // read as EAN-13
    expect(ndcLookupKeys("(01)00300450449108")?.upc).toBe("0300450449108"); // GTIN-14
    expect(ndcLookupKeys("3 00450 44910 8")?.upc).toBe("0300450449108");
  });

  it("looks up a valid UPC-A that is not NDC-based by its UPC alone", () => {
    // Store brands often print a retailer UPC instead of "3" + NDC.
    expect(ndcLookupKeys("036000291452")).toEqual({ ndc11: [], hyphenated: [], upc: "0036000291452" });
  });

  it("accepts an 11-digit NDC, plain or hyphenated 5-4-2, as pharmacy labels print it", () => {
    const keys = { ndc11: ["50580044910"], hyphenated: ["50580-449-10"], upc: null };
    expect(ndcLookupKeys("50580044910")).toEqual(keys);
    expect(ndcLookupKeys("50580-0449-10")).toEqual(keys);
    expect(ndcLookupKeys("NDC 50580-0449-10")).toEqual(keys);
  });

  it("lists every 10-digit hyphenation an 11-digit NDC could have come from", () => {
    // 00113-0020-26 is 0113-0020-26 (4-4-2) or 00113-020-26 (5-3-2).
    expect(ndcLookupKeys("00113002026")?.hyphenated).toEqual(["0113-0020-26", "00113-020-26"]);
  });

  it("rejects an 11-digit code with no padding zero (not a real NDC) and junk", () => {
    expect(ndcLookupKeys("12345678911")).toBeNull();
    expect(ndcLookupKeys("399999100053")).toBeNull(); // bad check digit
    expect(ndcLookupKeys("")).toBeNull();
    expect(ndcLookupKeys("hello")).toBeNull();
  });

  it("finds every fictional product by its barcode and its printed NDC", () => {
    for (const f of FICTIONAL_FORMULATIONS) {
      expect(ndcLookupKeys(f.upcA)?.ndc11).toContain(f.ndcPackages[0]);
      expect(ndcLookupKeys(f.ndc10)?.ndc11).toContain(f.ndcPackages[0]);
      expect(ndcLookupKeys(f.ndcPackages[0])?.ndc11).toEqual([f.ndcPackages[0]]);
    }
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
