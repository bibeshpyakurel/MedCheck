import { describe, expect, it } from "vitest";
import { makeEntry, mgPer } from "@/lib/checks/__fixtures__/entries";
import { formFamily } from "@/lib/checks/shared";
import { fixtureProducts } from "./__fixtures__";
import { NDC_DOSAGE_FORMS, dosageFormFor, refineForm } from "./dosage-form";

describe("dosageFormFor — NDC Directory dosage form → catalog value", () => {
  it("maps the forms of real products", () => {
    const form = (name: Parameters<typeof fixtureProducts>[0]) => dosageFormFor(fixtureProducts(name)[0].dosage_form!)?.form;
    expect(form("advil-tablets-caplets-gel-caplets")).toBe("tablet"); // TABLET, COATED
    expect(form("tylenol-extra-strength-tablet")).toBe("tablet"); // TABLET, FILM COATED
    expect(form("childrens-tylenol-suspension")).toBe("liquid"); // SUSPENSION
    expect(form("claritin-solution-per-ml")).toBe("liquid"); // SOLUTION
    expect(form("theraflu-syrup-count-strength")).toBe("liquid"); // SYRUP
    expect(form("advil-liquigel")).toBe("capsule"); // CAPSULE, LIQUID FILLED
    expect(form("nicotine-two-strengths")).toBe("lozenge");
  });

  it("keeps release type and chewables apart", () => {
    expect(dosageFormFor("TABLET, FILM COATED, EXTENDED RELEASE")?.form).toBe("extended-release tablet");
    expect(dosageFormFor("TABLET, CHEWABLE")?.form).toBe("chewable tablet");
    expect(dosageFormFor("CAPSULE, DELAYED RELEASE")?.form).toBe("delayed-release capsule");
  });

  it("does not map kits or forms it doesn't know", () => {
    expect(dosageFormFor("KIT")).toBeNull();
    expect(dosageFormFor("PELLET")).toBeNull();
    expect(dosageFormFor("SOMETHING NEW")).toBeNull();
  });

  it("gives every mapped form the family the checks will infer for it", () => {
    for (const info of Object.values(NDC_DOSAGE_FORMS)) {
      const strength =
        info.kind === "liquid" ? mgPer(1, 5, "mL") : info.kind === "semisolid" ? mgPer(1, 100, "g") : mgPer(1, 1, info.per ?? info.form);
      const entry = makeEntry({ id: "e", name: "x", form: info.form, ingredients: [{ name: "x", strength }] });
      expect([info.form, formFamily(entry)]).toEqual([info.form, info.kind === "liquid" ? "liquid" : "solid"]);
    }
  });
});

describe("refineForm — the label's own '(in each …)' wording", () => {
  const tablet = dosageFormFor("TABLET, FILM COATED")!;
  const capsule = dosageFormFor("CAPSULE, LIQUID FILLED")!;

  it("narrows a tablet to a caplet when the label says caplet", () => {
    expect(refineForm(tablet, ["caplet"]).form).toBe("caplet");
    expect(refineForm(tablet, ["tablet"]).form).toBe("tablet");
  });

  it("narrows a capsule to a softgel", () => {
    expect(refineForm(capsule, ["softgel"]).form).toBe("softgel");
  });

  it("keeps the NDC form when the label names several units or something outside the family", () => {
    expect(refineForm(tablet, ["tablet", "caplet", "gel caplet"]).form).toBe("tablet");
    expect(refineForm(tablet, ["softgel"]).form).toBe("tablet");
    expect(refineForm(tablet, ["brown tablet"]).form).toBe("tablet");
    expect(refineForm(tablet, []).form).toBe("tablet");
  });
});
