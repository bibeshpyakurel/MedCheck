import { describe, expect, it } from "vitest";
import { describeHistory, relativeTime, type HistoryEvent } from "./history-format";

const entryRow = (status: "draft" | "confirmed", name: string | null = "Calmora Fever Relief (Bottle A)") => ({
  id: "e1",
  status,
  fields: { productName: { aiValue: name, value: status === "confirmed" ? name : null, state: "pending" } },
});

const ev = (e: Partial<HistoryEvent>): HistoryEvent => ({
  id: 1,
  entity: "medication_entries",
  entityId: "e1",
  action: "insert",
  before: null,
  after: null,
  at: "2026-10-17T12:00:00Z",
  ...e,
});

describe("describeHistory", () => {
  it("describes confirming a medicine by name", () => {
    expect(describeHistory(ev({ action: "update", before: entryRow("draft"), after: entryRow("confirmed") })).title).toBe(
      "Medicine confirmed: Calmora Fever Relief (Bottle A)",
    );
  });

  it("describes a draft being added for review, using the suggested name", () => {
    expect(describeHistory(ev({ after: entryRow("draft") })).title).toBe(
      "Medicine added for review: Calmora Fever Relief (Bottle A)",
    );
  });

  it("describes edits and removals", () => {
    expect(describeHistory(ev({ action: "update", before: entryRow("confirmed"), after: entryRow("confirmed") })).title).toBe(
      "Medicine details changed: Calmora Fever Relief (Bottle A)",
    );
    expect(describeHistory(ev({ action: "delete", before: entryRow("confirmed") })).title).toBe(
      "Medicine removed: Calmora Fever Relief (Bottle A)",
    );
  });

  it("falls back to a placeholder when the row has no readable name", () => {
    expect(describeHistory(ev({ after: { status: "draft", fields: [] } })).title).toBe(
      "Medicine added for review: Unnamed medicine",
    );
  });

  it("describes source documents with their kind and details", () => {
    const d = describeHistory(
      ev({
        entity: "source_documents",
        after: { kind: "discharge_list", document_date: "2026-10-16", facility: "Lakeside Children's Hospital" },
      }),
    );
    expect(d.title).toBe("Document added: Discharge list");
    expect(d.detail).toBe("Lakeside Children's Hospital · 2026-10-16");
  });

  it("describes profile changes", () => {
    expect(describeHistory(ev({ entity: "patients", after: { display_name: "Sam" } })).title).toBe("Profile created: Sam");
    expect(
      describeHistory(ev({ entity: "patients", action: "update", before: { display_name: "Sam" }, after: { display_name: "Samuel" } }))
        .title,
    ).toBe("Profile renamed: Sam → Samuel");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  it("says just now, minutes, hours and days ago", () => {
    expect(relativeTime("2026-10-17T11:59:40Z", now)).toBe("just now");
    expect(relativeTime("2026-10-17T11:55:00Z", now)).toBe("5 minutes ago");
    expect(relativeTime("2026-10-17T09:00:00Z", now)).toBe("3 hours ago");
    expect(relativeTime("2026-10-16T12:00:00Z", now)).toBe("yesterday");
    expect(relativeTime("2026-10-10T12:00:00Z", now)).toBe("last week");
  });
});
