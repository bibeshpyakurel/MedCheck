import { describe, expect, it, vi } from "vitest";
import { geminiAttempts, tryModels } from "./fallback";

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
