import { describe, expect, it } from "vitest";
import { formatDocDate, isSelf, personDetails, personLabel, recordTitle } from "./record-format";

describe("self profiles", () => {
  const me = { displayName: "Jamie", relationship: "self", notes: null };
  const sam = { displayName: "Sam", relationship: "son", notes: "Age 13" };

  it("recognizes the self profile", () => {
    expect(isSelf(me)).toBe(true);
    expect(isSelf({ relationship: "Myself" })).toBe(true);
    expect(isSelf(sam)).toBe(false);
    expect(isSelf({ relationship: null })).toBe(false);
  });

  it("labels people and record headings", () => {
    expect(personLabel(me)).toBe("Me (Jamie)");
    expect(personLabel(sam)).toBe("Sam");
    expect(recordTitle(me)).toBe("My medicines");
    expect(recordTitle(sam)).toBe("Sam's medicines");
  });

  it("leaves 'self' out of the details line", () => {
    expect(personDetails(me)).toBe("");
    expect(personDetails(sam)).toBe("son · Age 13");
  });
});

describe("formatDocDate", () => {
  it("formats a calendar date without shifting it", () => {
    expect(formatDocDate("2026-10-16")).toBe("Oct 16, 2026");
    expect(formatDocDate(null)).toBeNull();
  });
});
