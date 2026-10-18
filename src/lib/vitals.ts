// Vitals from a VitalLens face scan: what MedCheck keeps from a result, and how it reads.
// Numbers and confidence only — never "normal", "high" or any judgement (evidence, not advice).
import { z } from "zod";

/** The confidence VitalLens's own widgets require before they show a value. */
export const VITAL_CONFIDENCE_THRESHOLD = 0.8;

/** Shown wherever a reading is: on the scan page, in the report and its email. */
export const VITALS_NOTE =
  "Estimated from a short face video by VitalLens, for general wellness. Not a medical device and not a diagnosis.";

/** `value` is null when VitalLens couldn't read it clearly (below the threshold, or missing). */
export type VitalEstimate = { value: number | null; confidence: number };
export type VitalReading = { heartRate: VitalEstimate; respiratoryRate: VitalEstimate };
export type SavedVitalReading = VitalReading & { id: string; measuredAt: string };

export type VitalLine = { label: string; text: string; confidence: string };

// Whole-number ranges a human reading can fall in; anything outside is a misread, not a value.
const HEART_RATE_RANGE = { min: 20, max: 250 };
const RESPIRATORY_RATE_RANGE = { min: 2, max: 60 };

const estimateSchema = (range: { min: number; max: number }) =>
  z.object({
    value: z.number().int().min(range.min).max(range.max).nullable(),
    confidence: z.number().min(0).max(1),
  });

export const vitalReadingSchema = z.object({
  heartRate: estimateSchema(HEART_RATE_RANGE),
  respiratoryRate: estimateSchema(RESPIRATORY_RATE_RANGE),
});

/** A VitalLens result (`vitals.heart_rate`, `vitals.respiratory_rate`) → a reading; null if it isn't one. */
export function readingFromResult(result: unknown): VitalReading | null {
  const vitals = (result as { vitals?: unknown } | null)?.vitals;
  if (!vitals || typeof vitals !== "object") return null;
  const v = vitals as Record<string, unknown>;
  if (!("heart_rate" in v) && !("respiratory_rate" in v)) return null;
  return {
    heartRate: estimate(v.heart_rate, HEART_RATE_RANGE),
    respiratoryRate: estimate(v.respiratory_rate, RESPIRATORY_RATE_RANGE),
  };
}

export function hasAnyValue(reading: VitalReading): boolean {
  return reading.heartRate.value !== null || reading.respiratoryRate.value !== null;
}

export function vitalLines(reading: VitalReading): VitalLine[] {
  return [
    line("Heart rate", reading.heartRate, "bpm"),
    line("Breathing rate", reading.respiratoryRate, "breaths/min"),
  ];
}

// ---------------------------------------------------------------------------

function estimate(raw: unknown, range: { min: number; max: number }): VitalEstimate {
  const vital = raw as { value?: unknown; confidence?: unknown } | null | undefined;
  // Live results carry a confidence per frame; the newest is the estimate's.
  const c = Array.isArray(vital?.confidence) ? vital.confidence.at(-1) : vital?.confidence;
  const confidence = typeof c === "number" && Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0;
  const v = vital?.value;
  const value = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
  const usable = value !== null && confidence >= VITAL_CONFIDENCE_THRESHOLD && value >= range.min && value <= range.max;
  return { value: usable ? value : null, confidence };
}

function line(label: string, e: VitalEstimate, unit: string): VitalLine {
  return {
    label,
    text: e.value === null ? "Couldn't read clearly" : `${e.value} ${unit}`,
    confidence: `${Math.round(e.confidence * 100)}% confidence`,
  };
}
