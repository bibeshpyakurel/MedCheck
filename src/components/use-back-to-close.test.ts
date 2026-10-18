import { describe, expect, it } from "vitest";
import { overlayStaysOpen } from "./use-back-to-close";

describe("overlayStaysOpen", () => {
  it("stays open when Back lands on its own entry", () => {
    expect(overlayStaysOpen({ medcheckOverlay: 5 }, 5)).toBe(true);
  });

  it("stays open when Back lands on an entry stacked above it (a sheet with steps under a sheet on top)", () => {
    // Compare sheet open (5), its results step (6), a label sheet on top (7): Back from 7 lands on 6.
    expect(overlayStaysOpen({ medcheckOverlay: 6 }, 5)).toBe(true);
  });

  it("closes when Back lands below its entry, or on the page itself", () => {
    expect(overlayStaysOpen({ medcheckOverlay: 4 }, 5)).toBe(false);
    expect(overlayStaysOpen(null, 5)).toBe(false);
    expect(overlayStaysOpen({ __NA: true }, 5)).toBe(false);
  });
});
