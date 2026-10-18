import { describe, expect, it } from "vitest";
import type { MatchOption } from "./photo-flow";
import { confirmLayout, initialChoice, opensPhotoAnswers, picksFrom, type MedicineChoice, type PhotoMatchItem } from "./photo-answers";

const option = (id: string, brandName = `Brand ${id}`): MatchOption => ({
  id,
  brandName,
  ingredients: [{ name: "Acetaminophen", strength: "500 mg per caplet" }],
  dosageForm: "caplet",
  labelerName: null,
  strengthDiffers: false,
  matchedByCode: false,
});
const item = (entryId: string, options: MatchOption[], selectedId: string | null): PhotoMatchItem => ({
  entryId,
  readName: "Tylenol",
  selectedId,
  options,
  onlySearch: options.length === 0,
});

describe("opensPhotoAnswers (after a read: the pop-up, or the next page)", () => {
  const read = (kind: "otc_package" | "prescription_label" | "discharge_list", next: string) => ({
    next,
    entryIds: ["e-1"],
    kind,
    sourceDocumentId: "d-1",
  });

  it("a package photo with something read opens the pop-up", () => {
    expect(opensPhotoAnswers(read("otc_package", "/patients/p-1/entries/e-1/match"))).toBe(true);
  });

  it("a package photo with nothing read goes to the retake page; other photos to the review", () => {
    expect(opensPhotoAnswers(read("otc_package", "/patients/p-1/entries/e-1/retake"))).toBe(false);
    expect(opensPhotoAnswers(read("prescription_label", "/patients/p-1/entries/e-1/review"))).toBe(false);
    expect(opensPhotoAnswers(read("discharge_list", "/patients/p-1/entries/e-1/review?notice=several-found"))).toBe(false);
  });
});

describe("confirmLayout", () => {
  it("one medicine asks “Is this …?”; two or three get a row each; more step through one at a time", () => {
    expect(confirmLayout(1)).toBe("one");
    expect(confirmLayout(2)).toBe("rows");
    expect(confirmLayout(3)).toBe("rows");
    expect(confirmLayout(4)).toBe("steps");
  });
});

describe("initialChoice", () => {
  it("starts with the pre-selected FDA label", () => {
    expect(initialChoice(item("e-1", [option("a"), option("b")], "a"))).toEqual({ kind: "label", option: option("a") });
  });

  it("starts with nothing chosen when no label was pre-selected or nothing was found", () => {
    expect(initialChoice(item("e-1", [option("a")], null))).toBeNull();
    expect(initialChoice(item("e-1", [], null))).toBeNull();
  });
});

describe("picksFrom", () => {
  const label = (id: string): MedicineChoice => ({ kind: "label", option: option(id) });

  it("one pick per medicine still in the photo, in photo order", () => {
    expect(
      picksFrom([
        { entryId: "e-1", choice: label("a"), removed: false },
        { entryId: "e-2", choice: { kind: "typed", name: "Grandma's cough drops" }, removed: false },
      ]),
    ).toEqual([
      { entryId: "e-1", formulationId: "a" },
      { entryId: "e-2", typedName: "Grandma's cough drops" },
    ]);
  });

  it("leaves out medicines removed from the photo, chosen or not", () => {
    expect(
      picksFrom([
        { entryId: "e-1", choice: label("a"), removed: true },
        { entryId: "e-2", choice: null, removed: true },
        { entryId: "e-3", choice: label("c"), removed: false },
      ]),
    ).toEqual([{ entryId: "e-3", formulationId: "c" }]);
  });

  it("null until every medicine left has a choice, and when none is left", () => {
    expect(picksFrom([{ entryId: "e-1", choice: label("a"), removed: false }, { entryId: "e-2", choice: null, removed: false }])).toBeNull();
    expect(picksFrom([{ entryId: "e-1", choice: label("a"), removed: true }])).toBeNull();
    expect(picksFrom([])).toBeNull();
  });

  it("a typed name counts only when it isn't blank", () => {
    expect(picksFrom([{ entryId: "e-1", choice: { kind: "typed", name: "  " }, removed: false }])).toBeNull();
    expect(picksFrom([{ entryId: "e-1", choice: { kind: "typed", name: " Zinc lozenges " }, removed: false }])).toEqual([
      { entryId: "e-1", typedName: "Zinc lozenges" },
    ]);
  });
});
