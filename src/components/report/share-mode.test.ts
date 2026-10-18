import { describe, expect, it } from "vitest";
import { shareMode } from "./share-mode";

describe("shareMode (what the report's Share button honestly does)", () => {
  it("is the share sheet where files can be shared (phones)", () => {
    expect(shareMode({ canShareFiles: true, emailConfigured: false })).toBe("share");
    expect(shareMode({ canShareFiles: true, emailConfigured: true })).toBe("share");
  });

  it("is “Download and email” where files can't be shared and MedCheck sends email itself", () => {
    expect(shareMode({ canShareFiles: false, emailConfigured: true })).toBe("download-and-email");
  });

  it("is hidden where it would do the same as “Send by email” (download plus your email app)", () => {
    expect(shareMode({ canShareFiles: false, emailConfigured: false })).toBe("hidden");
  });

  it("is Share until the browser is known (server render)", () => {
    expect(shareMode({ canShareFiles: null, emailConfigured: false })).toBe("share");
  });
});
