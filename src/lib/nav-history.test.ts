import { beforeEach, describe, expect, it } from "vitest";
import { isBackTo, previousUrl, recordVisit, resetVisits } from "./nav-history";

describe("isBackTo (whether Back in history lands on a back link's target)", () => {
  it("matches the same path", () => {
    expect(isBackTo("/patients/p-1", "/patients/p-1")).toBe(true);
  });

  it("compares the query too", () => {
    expect(isBackTo("/patients/p-1/entries/e-1/match", "/patients/p-1/entries/e-1/match")).toBe(true);
    expect(isBackTo("/patients/p-1/entries/e-1/match?search=1", "/patients/p-1/entries/e-1/match")).toBe(false);
  });

  it("ignores a trailing slash and a hash", () => {
    expect(isBackTo("/patients/p-1/", "/patients/p-1#medicines")).toBe(true);
  });

  it("never matches when there is no previous page in MedCheck", () => {
    expect(isBackTo(null, "/patients/p-1")).toBe(false);
  });

  it("a different page doesn't match", () => {
    expect(isBackTo("/patients/p-1/export", "/patients/p-1")).toBe(false);
  });
});

describe("recordVisit / previousUrl", () => {
  beforeEach(resetVisits);

  it("has no previous page on the first visit", () => {
    recordVisit("/a");
    expect(previousUrl()).toBeNull();
  });

  it("remembers the page before the current one", () => {
    recordVisit("/a");
    recordVisit("/b");
    expect(previousUrl()).toBe("/a");
  });

  it("a repeat of the current page (a re-render) changes nothing", () => {
    recordVisit("/a");
    recordVisit("/b");
    recordVisit("/b");
    expect(previousUrl()).toBe("/a");
  });
});
