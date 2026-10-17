import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";
import { describe, expect, it } from "vitest";
import { FICTIONAL_FORMULATIONS } from "@/data/fictional-formulations";
import { FALLBACK_BARCODE } from "@/data/demo-documents";
import { barRuns, encodeUpcA } from "./upc-a";

// Wikipedia's UPC-A example (036000291452), encoded by hand from the L/R tables.
const KNOWN =
  "101" +
  ["0001101", "0111101", "0101111", "0001101", "0001101", "0001101"].join("") +
  "01010" +
  ["1101100", "1110100", "1100110", "1011100", "1001110", "1101100"].join("") +
  "101";

/** Rasterize modules into a grayscale image and decode it with ZXing (the library the app's scanner uses). */
function decodeWithZxing(modules: string): { text: string; format: BarcodeFormat } {
  const scale = 3;
  const quiet = 12;
  const width = (modules.length + quiet * 2) * scale;
  const height = 40;
  const pixels = new Uint8ClampedArray(width * height).fill(255);
  for (let y = 0; y < height; y++) {
    for (let m = 0; m < modules.length; m++) {
      if (modules[m] !== "1") continue;
      for (let s = 0; s < scale; s++) pixels[y * width + (quiet + m) * scale + s] = 0;
    }
  }
  const reader = new MultiFormatReader();
  const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.UPC_A]]]);
  const result = reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, width, height))), hints);
  return { text: result.getText(), format: result.getBarcodeFormat() };
}

describe("encodeUpcA", () => {
  it("matches the published bar pattern for 036000291452", () => {
    expect(encodeUpcA("036000291452")).toBe(KNOWN);
  });

  it("always produces 95 modules with start, middle and end guards", () => {
    const m = encodeUpcA("399999100052");
    expect(m).toHaveLength(95);
    expect(m.slice(0, 3)).toBe("101");
    expect(m.slice(45, 50)).toBe("01010");
    expect(m.slice(92)).toBe("101");
  });

  it("rejects wrong length, non-digits and a bad check digit", () => {
    expect(() => encodeUpcA("12345")).toThrow();
    expect(() => encodeUpcA("39999910005X")).toThrow();
    expect(() => encodeUpcA("399999100053")).toThrow(/check digit/);
  });

  it.each<[string, string]>([
    ["Wikipedia example", "036000291452"],
    ...FICTIONAL_FORMULATIONS.map((f): [string, string] => [f.brandName, f.upcA]),
    ["NyQuil fallback", FALLBACK_BARCODE.upcA],
  ])("%s (%s) decodes back with ZXing as UPC-A", (_, upc) => {
    const { text, format } = decodeWithZxing(encodeUpcA(upc));
    expect(format).toBe(BarcodeFormat.UPC_A);
    expect(text).toBe(upc);
  });

  it("ZXing rejects a corrupted pattern (the decode check is not vacuous)", () => {
    const m = encodeUpcA("399999100052");
    const corrupted = m.slice(0, 20) + (m[20] === "1" ? "0" : "1") + m.slice(21);
    expect(() => decodeWithZxing(corrupted)).toThrow();
  });
});

describe("barRuns", () => {
  it("merges adjacent dark modules into bars", () => {
    expect(barRuns("1101000111")).toEqual([
      { x: 0, width: 2 },
      { x: 3, width: 1 },
      { x: 7, width: 3 },
    ]);
  });
});
