import { describe, expect, it } from "vitest";
import { cameraProblem, nativeScanFormats, SCAN_INTERVAL_MS, scanVideoConstraints } from "@/lib/barcode-scan";

describe("nativeScanFormats", () => {
  it("asks only for the drug-package formats the device supports", () => {
    expect(nativeScanFormats(["qr_code", "upc_a", "ean_13", "data_matrix", "code_128", "aztec"])).toEqual([
      "upc_a",
      "ean_13",
      "data_matrix",
      "code_128",
    ]);
    expect(nativeScanFormats(["qr_code", "upc_a"])).toEqual(["upc_a"]);
  });

  it("is empty when none is supported, so the scanner falls back to ZXing", () => {
    expect(nativeScanFormats(["qr_code"])).toEqual([]);
    expect(nativeScanFormats([])).toEqual([]);
  });
});

describe("scanVideoConstraints", () => {
  it("uses the rear camera at HD, sharp enough for the thin bars on a small box", () => {
    const c = scanVideoConstraints();
    expect(c.facingMode).toEqual({ ideal: "environment" });
    expect(c.width).toEqual({ ideal: 1920 });
    expect(c.height).toEqual({ ideal: 1080 });
  });
});

it("checks frames several times a second", () => {
  expect(SCAN_INTERVAL_MS).toBeLessThanOrEqual(120);
});

describe("cameraProblem", () => {
  it("is a blocked permission when the person or the browser said no", () => {
    expect(cameraProblem("NotAllowedError", true)).toBe("denied");
    expect(cameraProblem("SecurityError", true)).toBe("denied");
  });

  it("is a page without HTTPS whatever the error, since phones only allow the camera there", () => {
    expect(cameraProblem("NotAllowedError", false)).toBe("insecure");
    expect(cameraProblem("", false)).toBe("insecure");
  });

  it("is a camera that didn't start for anything else (none found, busy in another app)", () => {
    expect(cameraProblem("NotFoundError", true)).toBe("unavailable");
    expect(cameraProblem("NotReadableError", true)).toBe("unavailable");
    expect(cameraProblem("OverconstrainedError", true)).toBe("unavailable");
    expect(cameraProblem("", true)).toBe("unavailable");
  });
});
