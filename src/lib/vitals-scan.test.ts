import { describe, expect, it } from "vitest";
import { SCAN_MS, faceConfidence, faceInView, scanFailureMessage, scanHint, scanProgress } from "./vitals-scan";

describe("scanProgress (the 30-second countdown)", () => {
  it("counts down whole seconds and fills up to done", () => {
    expect(scanProgress(0)).toEqual({ fraction: 0, secondsLeft: 30, done: false });
    expect(scanProgress(12_400)).toEqual({ fraction: 12_400 / SCAN_MS, secondsLeft: 18, done: false });
    expect(scanProgress(29_999)).toMatchObject({ secondsLeft: 1, done: false });
    expect(scanProgress(SCAN_MS)).toEqual({ fraction: 1, secondsLeft: 0, done: true });
    expect(scanProgress(45_000)).toEqual({ fraction: 1, secondsLeft: 0, done: true });
  });

  it("treats a clock that went backwards as the start", () => {
    expect(scanProgress(-50)).toEqual({ fraction: 0, secondsLeft: 30, done: false });
  });
});

describe("faceConfidence (how sure VitalLens is that a face is in view)", () => {
  it("reads a single number or the newest of a per-frame list", () => {
    expect(faceConfidence({ face: { confidence: 0.7 } })).toBe(0.7);
    expect(faceConfidence({ face: { confidence: [0.1, 0.92] } })).toBe(0.92);
  });

  it("is null before VitalLens has said anything", () => {
    expect(faceConfidence(null)).toBeNull();
    expect(faceConfidence({})).toBeNull();
    expect(faceConfidence({ face: { confidence: [] } })).toBeNull();
  });
});

describe("faceInView", () => {
  it("needs VitalLens's own face confidence of 0.5", () => {
    expect(faceInView(null)).toBe(false);
    expect(faceInView(0.49)).toBe(false);
    expect(faceInView(0.5)).toBe(true);
  });
});

describe("scanHint", () => {
  it("asks for the face until one is seen, then to hold still", () => {
    expect(scanHint(null)).toBe("Finding your face…");
    expect(scanHint(0.2)).toBe("Keep your face inside the oval");
    expect(scanHint(0.9)).toBe("Hold still");
  });
});

describe("scanFailureMessage (why the scan couldn't start; nothing is saved)", () => {
  const wrapped = (status: number) =>
    new Error(`Model resolution request failed: Error: Failed to resolve model config: Status ${status} - {"error":"x"}`);

  it("names a site that has no VitalLens key yet", () => {
    expect(scanFailureMessage(wrapped(503))).toMatch(/aren't set up/);
  });

  it("names a key VitalLens turned down", () => {
    expect(scanFailureMessage(wrapped(403))).toMatch(/didn't accept/);
    expect(scanFailureMessage(wrapped(401))).toMatch(/didn't accept/);
    expect(scanFailureMessage(Object.assign(new Error("A valid API key or proxy URL is required"), { name: "VitalLensAPIKeyError" }))).toMatch(
      /didn't accept/,
    );
  });

  it("names a used-up free plan", () => {
    expect(scanFailureMessage(wrapped(429))).toMatch(/used up/);
    expect(scanFailureMessage(Object.assign(new Error("quota"), { name: "VitalLensAPIQuotaExceededError" }))).toMatch(/used up/);
  });

  it("falls back to a connection problem", () => {
    expect(scanFailureMessage(new TypeError("Failed to fetch"))).toMatch(/couldn't reach VitalLens/);
    expect(scanFailureMessage("weird")).toMatch(/couldn't reach VitalLens/);
  });
});
