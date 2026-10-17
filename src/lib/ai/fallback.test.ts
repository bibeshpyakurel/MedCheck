import { describe, expect, it, vi } from "vitest";
import { attemptTimeout, DESCRIBE_BUDGET_MS, geminiAttempts, tryModels } from "./fallback";

describe("geminiAttempts", () => {
  it("defaults to a fast primary and a stronger fallback, each with its own timeout", () => {
    expect(geminiAttempts({})).toEqual([
      { modelId: "gemini-3.5-flash-lite", timeoutMs: 20_000 },
      { modelId: "gemini-3.5-flash", timeoutMs: 25_000 },
    ]);
  });

  it("uses the configured models", () => {
    expect(geminiAttempts({ GEMINI_MODEL: "a", GEMINI_FALLBACK_MODEL: "b" }).map((a) => a.modelId)).toEqual(["a", "b"]);
  });

  it("skips the fallback when it is the same model or disabled", () => {
    expect(geminiAttempts({ GEMINI_MODEL: "a", GEMINI_FALLBACK_MODEL: "a" })).toHaveLength(1);
    expect(geminiAttempts({ GEMINI_FALLBACK_MODEL: "none" })).toHaveLength(1);
  });

  it("keeps the total time inside the 60 s route limit", () => {
    const total = geminiAttempts({}).reduce((sum, a) => sum + a.timeoutMs, 0);
    expect(total).toBeLessThan(60_000);
  });
});

describe("tryModels", () => {
  const attempts = [
    { modelId: "fast", timeoutMs: 1 },
    { modelId: "strong", timeoutMs: 1 },
  ];

  it("returns the first model's answer without calling the next", async () => {
    const run = vi.fn(async (a: { modelId: string }) => a.modelId);
    await expect(tryModels(attempts, run)).resolves.toBe("fast");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("falls back when the first model fails, and reports the failure", async () => {
    const onFail = vi.fn();
    const run = async (a: { modelId: string }) => {
      if (a.modelId === "fast") throw new Error("high demand");
      return a.modelId;
    };
    await expect(tryModels(attempts, run, onFail)).resolves.toBe("strong");
    expect(onFail).toHaveBeenCalledWith(attempts[0], expect.any(Error));
  });

  it("throws the last error when every model fails", async () => {
    const run = async (a: { modelId: string }) => {
      throw new Error(`${a.modelId} down`);
    };
    await expect(tryModels(attempts, run)).rejects.toThrow("strong down");
  });
});

describe("attemptTimeout", () => {
  const attempts = [
    { modelId: "fast", timeoutMs: 20_000 },
    { modelId: "strong", timeoutMs: 25_000 },
  ];

  it("uses each attempt's own timeout when there is no budget", () => {
    expect(attemptTimeout(attempts, 0, Infinity)).toBe(20_000);
    expect(attemptTimeout(attempts, 1, Infinity)).toBe(25_000);
  });

  it("scales the first attempt down so the fallback keeps its share of a tight budget", () => {
    expect(attemptTimeout(attempts, 0, 20_000)).toBe(8_888);
  });

  it("gives the last attempt everything that is left, up to its own timeout", () => {
    expect(attemptTimeout(attempts, 1, 19_000)).toBe(19_000);
    expect(attemptTimeout(attempts, 1, 40_000)).toBe(25_000);
  });
});

describe("tryModels with a budget", () => {
  const attempts = [
    { modelId: "fast", timeoutMs: 20_000 },
    { modelId: "strong", timeoutMs: 25_000 },
  ];

  it("hands the fallback the time the first model didn't use", async () => {
    let clock = 0;
    const seen: number[] = [];
    const run = async (a: { modelId: string; timeoutMs: number }) => {
      seen.push(a.timeoutMs);
      if (a.modelId === "fast") {
        clock += 1_000; // "high demand" after a second
        throw new Error("high demand");
      }
      return a.modelId;
    };
    await expect(tryModels(attempts, run, undefined, { budgetMs: 20_000, now: () => clock })).resolves.toBe("strong");
    expect(seen).toEqual([8_888, 19_000]);
  });

  it("never spends longer than the budget in total", async () => {
    let clock = 0;
    const seen: number[] = [];
    const run = async (a: { timeoutMs: number }) => {
      seen.push(a.timeoutMs);
      clock += a.timeoutMs; // every attempt times out
      throw new Error("timed out");
    };
    await expect(tryModels(attempts, run, undefined, { budgetMs: 20_000, now: () => clock })).rejects.toThrow("timed out");
    expect(seen.reduce((s, t) => s + t, 0)).toBeLessThanOrEqual(20_000);
  });

  it("skips an attempt when less than a second is left", async () => {
    let clock = 0;
    const run = vi.fn(async () => {
      clock += 19_500;
      throw new Error("slow");
    });
    await expect(tryModels(attempts, run, undefined, { budgetMs: 20_000, now: () => clock })).rejects.toThrow("slow");
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("describe timing", () => {
  it("fits both models inside the describe budget, with the retry starting well before it ends", () => {
    const firstTimeout = attemptTimeout(geminiAttempts({}), 0, DESCRIBE_BUDGET_MS);
    expect(DESCRIBE_BUDGET_MS).toBeLessThanOrEqual(25_000);
    expect(firstTimeout).toBeLessThan(DESCRIBE_BUDGET_MS / 2);
  });
});
