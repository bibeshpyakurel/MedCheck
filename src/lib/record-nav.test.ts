import { describe, expect, it } from "vitest";
import { recordNav } from "@/lib/record-nav";

const P = "/patients/5d7b2a6e-4b8e-4a8e-9a43-0c1f9a3b2c11";
const E = `${P}/entries/0f8e8f5c-2d3a-4a8b-b8d0-9e5a6c7d8e9f`;

describe("recordNav", () => {
  it("marks Medicines on the list and on a medicine's page", () => {
    expect(recordNav(P)).toEqual({ current: "medicines", hidden: false });
    expect(recordNav(E)).toEqual({ current: "medicines", hidden: false });
  });

  it("marks Report on the report and its preview", () => {
    expect(recordNav(`${P}/export`)).toEqual({ current: "report", hidden: false });
    expect(recordNav(`${P}/export/preview`)).toEqual({ current: "report", hidden: false });
  });

  it("hides inside the add flow and on the review, which have their own bars", () => {
    for (const path of [`${P}/add`, `${P}/add/photo`, `${E}/match`, `${E}/retake`, `${E}/review`]) {
      expect(recordNav(path).hidden, path).toBe(true);
    }
  });
});
