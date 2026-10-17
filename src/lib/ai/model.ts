import "server-only";

import { google } from "@ai-sdk/google";

/** True when a Gemini API key is configured. Without it, capture still works and every field starts unknown. */
export function hasGeminiKey(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
}

export function geminiModel() {
  return google(process.env.GEMINI_MODEL || "gemini-flash-latest");
}

/** Shared call settings: one retry, and a timeout well inside the route's maxDuration. */
export const GEMINI_CALL = { maxRetries: 1, timeout: 45_000 } as const;
