import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyEntryFields } from "./domain/fields";

// records.ts runs as the signed-in user through the server client; record what it asks Supabase for.
const calls: { table: string; update: unknown; filters: [string, unknown][] }[] = [];
let returnedRows: { id: string }[] = [];

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from(table: string) {
      const call = { table, update: undefined as unknown, filters: [] as [string, unknown][] };
      calls.push(call);
      const builder = {
        update(values: unknown) {
          call.update = values;
          return builder;
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value]);
          return builder;
        },
        select: async () => ({ data: returnedRows, error: null }),
      };
      return builder;
    },
  }),
}));

const { confirmDraftEntry } = await import("./records");

describe("confirmDraftEntry", () => {
  beforeEach(() => {
    calls.length = 0;
    returnedRows = [{ id: "e-1" }];
  });

  it("confirms only a draft: fields, catalog label and status in one update", async () => {
    const fields = emptyEntryFields();
    await confirmDraftEntry("e-1", fields, "f-1");
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.table).toBe("medication_entries");
    expect(call.update).toMatchObject({ fields, formulation_id: "f-1", status: "confirmed" });
    expect(typeof (call.update as { confirmed_at: unknown }).confirmed_at).toBe("string");
    expect(call.filters).toEqual([
      ["id", "e-1"],
      ["status", "draft"],
    ]);
  });

  it("can confirm without a catalog label (Save without a match)", async () => {
    await confirmDraftEntry("e-1", emptyEntryFields(), null);
    expect(calls[0].update).toMatchObject({ formulation_id: null, status: "confirmed" });
  });

  it("does not touch input_method (a photo entry stays a photo entry)", async () => {
    await confirmDraftEntry("e-1", emptyEntryFields(), "f-1");
    expect(calls[0].update).not.toHaveProperty("input_method");
  });

  it("throws when no draft was updated (already confirmed, or not the user's)", async () => {
    returnedRows = [];
    await expect(confirmDraftEntry("e-1", emptyEntryFields(), "f-1")).rejects.toThrow(/draft/);
  });

  it("refuses fields that don't fit the contract", async () => {
    const bad = { ...emptyEntryFields(), productName: { aiValue: null, value: "", state: "confirmed", evidence: { kind: "none" } } };
    await expect(confirmDraftEntry("e-1", bad as never, "f-1")).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});
