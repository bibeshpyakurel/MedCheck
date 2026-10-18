import { describe, expect, it } from "vitest";
import { canRunHeavyFx, fxOverride } from "@/lib/fx";

const capable = {
  buildEnabled: true,
  override: null,
  reducedMotion: false,
  saveData: false,
  deviceMemory: 8,
  cores: 8,
};

describe("fxOverride", () => {
  it("reads ?fx=0 and ?fx=1, and ignores anything else", () => {
    expect(fxOverride("?fx=0")).toBe("off");
    expect(fxOverride("?a=1&fx=1")).toBe("on");
    expect(fxOverride("?fx=maybe")).toBeNull();
    expect(fxOverride("")).toBeNull();
  });
});

describe("canRunHeavyFx", () => {
  it("runs on a capable device", () => {
    expect(canRunHeavyFx(capable)).toBe(true);
  });

  it("never runs with reduced motion, Save-Data, or the build switch off", () => {
    expect(canRunHeavyFx({ ...capable, reducedMotion: true })).toBe(false);
    expect(canRunHeavyFx({ ...capable, saveData: true })).toBe(false);
    expect(canRunHeavyFx({ ...capable, buildEnabled: false })).toBe(false);
  });

  it("skips low-memory or low-core devices; unknown values count as capable", () => {
    expect(canRunHeavyFx({ ...capable, deviceMemory: 2 })).toBe(false);
    expect(canRunHeavyFx({ ...capable, cores: 2 })).toBe(false);
    expect(canRunHeavyFx({ ...capable, deviceMemory: undefined, cores: undefined })).toBe(true);
  });

  it("?fx=0 turns effects off live; ?fx=1 can't override reduced motion", () => {
    expect(canRunHeavyFx({ ...capable, override: "off" })).toBe(false);
    expect(canRunHeavyFx({ ...capable, override: "on", deviceMemory: 2 })).toBe(true);
    expect(canRunHeavyFx({ ...capable, override: "on", reducedMotion: true })).toBe(false);
  });
});
