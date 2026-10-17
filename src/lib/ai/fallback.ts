// Which Gemini models to try, in order. Larger Flash models slow to 45–60 s (or answer "high demand")
// when Google is busy, and free-tier keys are throttled first; Flash-Lite answers in about a second.
// So: a fast primary with a short timeout, then one stronger fallback, together inside the route's 60 s.
// Pure — no SDK imports — so it can be unit-tested.

export type ModelAttempt = { modelId: string; timeoutMs: number };

const PRIMARY_DEFAULT = "gemini-3.5-flash-lite";
const FALLBACK_DEFAULT = "gemini-3.5-flash";

export function geminiAttempts(env: { GEMINI_MODEL?: string; GEMINI_FALLBACK_MODEL?: string }): ModelAttempt[] {
  const primary = env.GEMINI_MODEL?.trim() || PRIMARY_DEFAULT;
  const fallback = env.GEMINI_FALLBACK_MODEL?.trim() || FALLBACK_DEFAULT;
  const attempts: ModelAttempt[] = [{ modelId: primary, timeoutMs: 20_000 }];
  if (fallback !== "none" && fallback !== primary) attempts.push({ modelId: fallback, timeoutMs: 25_000 });
  return attempts;
}

/** Runs `run` for each attempt in order and returns the first success; throws the last error if all fail. */
export async function tryModels<T>(
  attempts: ModelAttempt[],
  run: (attempt: ModelAttempt) => Promise<T>,
  onFail?: (attempt: ModelAttempt, error: unknown) => void,
): Promise<T> {
  let lastError: unknown = new Error("No Gemini model configured");
  for (const attempt of attempts) {
    try {
      return await run(attempt);
    } catch (error) {
      lastError = error;
      onFail?.(attempt, error);
    }
  }
  throw lastError;
}
