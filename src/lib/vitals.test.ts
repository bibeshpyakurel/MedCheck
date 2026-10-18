import { describe, expect, it } from "vitest";
import {
  VITAL_CONFIDENCE_THRESHOLD,
  hasAnyValue,
  readingFromResult,
  vitalLines,
  vitalReadingSchema,
  type VitalReading,
} from "./vitals";

const result = (hr: unknown, rr: unknown) => ({ vitals: { heart_rate: hr, respiratory_rate: rr }, fps: 30, message: "estimates" });

describe("readingFromResult (a VitalLens result → what MedCheck keeps)", () => {
  it("keeps confident values, rounded to whole numbers", () => {
    expect(
      readingFromResult(result({ value: 72.4, unit: "bpm", confidence: 0.92 }, { value: 13.6, unit: "bpm", confidence: 0.97 })),
    ).toEqual({ heartRate: { value: 72, confidence: 0.92 }, respiratoryRate: { value: 14, confidence: 0.97 } });
  });

  it("drops a value below the confidence threshold but keeps its confidence", () => {
    const r = readingFromResult(result({ value: 88, confidence: 0.5 }, { value: 15, confidence: VITAL_CONFIDENCE_THRESHOLD }));
    expect(r).toEqual({ heartRate: { value: null, confidence: 0.5 }, respiratoryRate: { value: 15, confidence: 0.8 } });
  });

  it("reads a per-frame confidence array by its last entry", () => {
    const r = readingFromResult(result({ value: 61, confidence: [0.2, 0.6, 0.91] }, { value: 12, confidence: [0.99] }));
    expect(r?.heartRate).toEqual({ value: 61, confidence: 0.91 });
  });

  it("treats a missing vital as unread", () => {
    expect(readingFromResult(result({ value: 70, confidence: 0.9 }, undefined))).toEqual({
      heartRate: { value: 70, confidence: 0.9 },
      respiratoryRate: { value: null, confidence: 0 },
    });
  });

  it("drops values outside a human range even when confident", () => {
    expect(readingFromResult(result({ value: 400, confidence: 0.99 }, { value: 0, confidence: 0.99 }))).toEqual({
      heartRate: { value: null, confidence: 0.99 },
      respiratoryRate: { value: null, confidence: 0.99 },
    });
  });

  it("returns null for something that isn't a VitalLens result", () => {
    expect(readingFromResult(null)).toBeNull();
    expect(readingFromResult({})).toBeNull();
    expect(readingFromResult({ vitals: "nope" })).toBeNull();
  });
});

describe("vitalLines (numbers and confidence only; never a judgement)", () => {
  it("shows the value with its unit and the confidence as a percentage", () => {
    const r: VitalReading = { heartRate: { value: 72, confidence: 0.92 }, respiratoryRate: { value: 14, confidence: 0.975 } };
    expect(vitalLines(r)).toEqual([
      { label: "Heart rate", text: "72 bpm", confidence: "92% confidence" },
      { label: "Breathing rate", text: "14 breaths/min", confidence: "98% confidence" },
    ]);
  });

  it("says a value couldn't be read clearly instead of guessing", () => {
    const r: VitalReading = { heartRate: { value: null, confidence: 0.41 }, respiratoryRate: { value: 16, confidence: 0.9 } };
    expect(vitalLines(r)[0]).toEqual({ label: "Heart rate", text: "Couldn't read clearly", confidence: "41% confidence" });
  });

  it("never uses judging words", () => {
    const r: VitalReading = { heartRate: { value: 140, confidence: 0.95 }, respiratoryRate: { value: 30, confidence: 0.95 } };
    const text = JSON.stringify(vitalLines(r)).toLowerCase();
    for (const word of ["normal", "high", "low", "safe", "healthy", "elevated"]) expect(text).not.toContain(word);
  });
});

describe("hasAnyValue", () => {
  it("is true when at least one vital was read", () => {
    expect(hasAnyValue({ heartRate: { value: 70, confidence: 0.9 }, respiratoryRate: { value: null, confidence: 0.1 } })).toBe(true);
    expect(hasAnyValue({ heartRate: { value: null, confidence: 0.3 }, respiratoryRate: { value: null, confidence: 0.1 } })).toBe(false);
  });
});

describe("vitalReadingSchema (what a save action accepts)", () => {
  it("accepts a reading and rejects out-of-range numbers", () => {
    expect(vitalReadingSchema.safeParse({ heartRate: { value: 72, confidence: 0.9 }, respiratoryRate: { value: null, confidence: 0.2 } }).success).toBe(true);
    expect(vitalReadingSchema.safeParse({ heartRate: { value: 900, confidence: 0.9 }, respiratoryRate: { value: 12, confidence: 0.9 } }).success).toBe(false);
    expect(vitalReadingSchema.safeParse({ heartRate: { value: 72, confidence: 2 }, respiratoryRate: { value: 12, confidence: 0.9 } }).success).toBe(false);
  });
});
