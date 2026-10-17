// Which Gemini models to try, in order. Larger Flash models slow to 45–60 s (or answer "high demand")
// when Google is busy, and free-tier keys are throttled first; Flash-Lite answers in about a second.
// So: a fast primary with a short timeout, then one stronger fallback, together inside the route's 60 s.
// Pure — no SDK imports — so it can be unit-tested.

export type ModelAttempt = { modelId: string; timeoutMs: number };

const PRIMARY_DEFAULT = "gemini-3.5-flash-lite";
const FALLBACK_DEFAULT = "gemini-3.5-flash";

/** Below this, another attempt can't realistically answer, so we stop instead. */
const MIN_ATTEMPT_MS = 1_000;

export function geminiAttempts(env: { GEMINI_MODEL?: string; GEMINI_FALLBACK_MODEL?: string }): ModelAttempt[] {
  const primary = env.GEMINI_MODEL?.trim() || PRIMARY_DEFAULT;
  const fallback = env.GEMINI_FALLBACK_MODEL?.trim() || FALLBACK_DEFAULT;
  const attempts: ModelAttempt[] = [{ modelId: primary, timeoutMs: 20_000 }];
  if (fallback !== "none" && fallback !== primary) attempts.push({ modelId: fallback, timeoutMs: 25_000 });
  return attempts;
}

/**
 * The timeout for attempt `index` given the time left: its own timeout, scaled down so the attempts
 * after it keep their share. The last attempt gets whatever is left, up to its own timeout.
 */
export function attemptTimeout(attempts: ModelAttempt[], index: number, remainingMs: number): number {
  const own = attempts[index].timeoutMs;
  if (index === attempts.length - 1 || remainingMs === Infinity) return Math.min(own, remainingMs);
  const rest = attempts.slice(index).reduce((sum, a) => sum + a.timeoutMs, 0);
  return Math.min(own, Math.floor((remainingMs * own) / rest));
}

/**
 * Runs `run` for each attempt in order and returns the first success; throws the last error if all fail.
 * With `budgetMs`, every attempt's timeout is fitted so the whole call ends within the budget.
 */
export async function tryModels<T>(
  attempts: ModelAttempt[],
  run: (attempt: ModelAttempt) => Promise<T>,
  onFail?: (attempt: ModelAttempt, error: unknown) => void,
  opts: { budgetMs?: number; now?: () => number } = {},
): Promise<T> {
  const now = opts.now ?? Date.now;
  const deadline = opts.budgetMs === undefined ? Infinity : now() + opts.budgetMs;
  let lastError: unknown = new Error("No Gemini model configured");
  for (const [index, attempt] of attempts.entries()) {
    const timeoutMs = attemptTimeout(attempts, index, deadline - now());
    if (deadline !== Infinity && timeoutMs < MIN_ATTEMPT_MS) break;
    try {
      return await run({ ...attempt, timeoutMs });
    } catch (error) {
      lastError = error;
      onFail?.(attempt, error);
    }
  }
  throw lastError;
}
