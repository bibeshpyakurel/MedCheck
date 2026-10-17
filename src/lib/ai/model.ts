import "server-only";

import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { geminiAttempts, tryModels } from "./fallback";

/** True when a Gemini API key is configured. Without it, capture still works and every field starts unknown. */
export function hasGeminiKey(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
}

export type GeminiCallSettings = { model: LanguageModel; maxRetries: number; timeout: number };

/**
 * Runs a Gemini call against the primary model, then the fallback if it fails or times out.
 * No SDK retries: the fallback model is the retry. Configure with GEMINI_MODEL / GEMINI_FALLBACK_MODEL.
 */
export function withGemini<T>(run: (settings: GeminiCallSettings) => Promise<T>): Promise<T> {
  return tryModels(
    geminiAttempts({ GEMINI_MODEL: process.env.GEMINI_MODEL, GEMINI_FALLBACK_MODEL: process.env.GEMINI_FALLBACK_MODEL }),
    (attempt) => run({ model: google(attempt.modelId), maxRetries: 0, timeout: attempt.timeoutMs }),
    (attempt, error) =>
      console.warn(`Gemini ${attempt.modelId} failed; trying the next model`, error instanceof Error ? error.message : error),
  );
}
