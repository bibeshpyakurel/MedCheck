// Live barcode scanning settings. Pure; safe on client and server.
// A drug package carries a UPC-A (or EAN-13), sometimes a GS1 DataMatrix or Code 128.

/** The formats worth looking for, in the native BarcodeDetector's names. */
const DRUG_FORMATS = ["upc_a", "ean_13", "data_matrix", "code_128"] as const;

/** How often a frame is checked while the camera is live. */
export const SCAN_INTERVAL_MS = 80;

/** The drug-package formats this device's BarcodeDetector supports; empty means use ZXing instead. */
export function nativeScanFormats(supported: readonly string[]): string[] {
  return DRUG_FORMATS.filter((format) => supported.includes(format));
}

/**
 * The rear camera at HD: at the default 640 × 480 the bars of a small box's barcode blur together.
 * Continuous autofocus is asked for separately, after the camera starts (not every browser knows it).
 */
export function scanVideoConstraints(): MediaTrackConstraints {
  return { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } };
}
