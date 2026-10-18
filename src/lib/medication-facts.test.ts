import { describe, expect, it } from "vitest";
import { FICTIONAL_FORMULATIONS } from "@/data/fictional-formulations";
import type { Formulation } from "@/lib/domain/schema";
import labels from "./__fixtures__/quick-answers-labels.json";
import { markRanges, medicationFacts, resolveRef, STATUS_TEXT } from "./medication-facts";

// Real catalog rows (live import, October 2026), copied verbatim.
const L = labels as unknown as Record<keyof typeof labels, Formulation>;
const calmora: Formulation = { ...FICTIONAL_FORMULATIONS[0], id: "calmora-a" };

describe("header and status", () => {
  it("is fictional, hand-checked, or FDA-published, in that order of precedence", () => {
    expect(medicationFacts(calmora).header.status).toBe("fictional");
    expect(medicationFacts({ ...L.advil, reviewed: true }).header.status).toBe("hand_checked");
    expect(medicationFacts(L.advil).header.status).toBe("fda_published");
    expect(STATUS_TEXT.fda_published).toBe("FDA-published label · not hand-checked");
  });

  it("names the product, each ingredient with strength, the labeler, date and form", () => {
    expect(medicationFacts(L.advil).header).toEqual({
      name: "ADVIL",
      ingredients: ["Ibuprofen 200 mg per tablet"],
      labeler: "Haleon US Holdings LLC",
      labelDate: "2026-03-12",
      dosageForm: "tablet",
      status: "fda_published",
    });
  });
});

describe("ingredient card", () => {
  it("splits each strength into its amount and what it is per", () => {
    expect(medicationFacts(L.advil).hero.ingredients).toEqual([{ name: "Ibuprofen", amount: "200 mg", per: "per tablet" }]);
    expect(medicationFacts(L.childrensTylenol).hero.ingredients[0]).toMatchObject({ amount: "160 mg", per: "per 5 mL" });
  });

  it("quotes the label's Purpose lines", () => {
    expect(medicationFacts(L.advil).hero.purposes.map((l) => l.text)).toEqual(["Pain reliever/Fever reducer"]);
    expect(medicationFacts(L.advil).hero.purposes[0].ref).toEqual({ source: "purpose", index: 0 });
  });
});

describe("resolveRef", () => {
  it("returns the raw text a ref points at", () => {
    expect(resolveRef(L.advil, { source: "uses", index: 1 })).toBe("toothache");
    expect(resolveRef(L.advil, { source: "max_24h_text", index: 0 })).toBe(L.advil.max24hText);
    expect(resolveRef(L.advil, { source: "warnings_quotes", index: 0 })).toBe(L.advil.warningsQuotes[0]);
    expect(resolveRef(L.advil, { source: "uses", index: 99 })).toBeNull();
  });
});

describe("source", () => {
  it("carries the set ID, NDCs and links", () => {
    expect(medicationFacts(L.advil).source).toEqual({
      kind: "openfda",
      setId: "1a665e64-9f30-be37-4a83-38789f1f1e89",
      ndcs: ["00573016520"],
      links: L.advil.sourceLinks,
    });
  });
});

describe("uses", () => {
  const texts = (g: { tiles: { text: string }[] }) => g.tiles.map((t) => t.text);

  it("Advil: one list under its lead, then fever on its own", () => {
    const u = medicationFacts(L.advil).uses;
    expect(u.map((g) => g.lead?.text ?? null)).toEqual(["temporarily relieves minor aches and pains due to:", null]);
    expect(texts(u[0])).toEqual(["headache", "toothache", "backache", "menstrual cramps", "the common cold", "muscular aches", "minor pain of arthritis"]);
    expect(texts(u[1])).toEqual(["temporarily reduces fever"]);
    expect(u[0].tiles.map((t) => t.icon)).toEqual(["zap", "activity", "activity", "activity", "snowflake", "activity", "activity"]);
    expect(u[1].tiles[0].icon).toBe("thermometer");
  });

  it("Children's Tylenol: each colon starts a list; a leading list glyph is dropped", () => {
    const u = medicationFacts(L.childrensTylenol).uses;
    expect(u.map((g) => g.lead?.text)).toEqual(["temporarily:", "relieves minor aches and pains due to:"]);
    expect(texts(u[0])).toEqual(["reduces fever"]);
    expect(texts(u[1])).toEqual(["the common cold", "flu", "headache", "sore throat", "toothache"]);
  });

  it("Benadryl: a second lead starts a second list", () => {
    const u = medicationFacts(L.benadrylLiquid).uses;
    expect(u.map((g) => g.lead?.text)).toEqual([
      "temporarily relieves these symptoms due to hay fever or other upper respiratory allergies:",
      "temporarily relieves these symptoms due to the common cold:",
    ]);
    expect(texts(u[1])).toEqual(["runny nose", "sneezing"]);
    expect(u[1].tiles.map((t) => t.icon)).toEqual(["wind", "wind"]);
  });

  it("a Uses bullet with no colon is one tile, verbatim (Pepcid)", () => {
    const u = medicationFacts(L.pepcidAcMax).uses;
    expect(u).toHaveLength(1);
    expect(u[0].lead).toBeNull();
    expect(texts(u[0])).toEqual(L.pepcidAcMax.labelSections.uses);
    expect(u[0].tiles[0].icon).toBe("flame");
  });

  it("a label without Uses has no groups", () => {
    expect(medicationFacts({ ...L.advil, labelSections: {} }).uses).toEqual([]);
  });
});

describe("directions", () => {
  const marked = (text: string) => markRanges(text).map(([s, e]) => text.slice(s, e));

  it("Advil: one block per form, each with its age cards in label order", () => {
    const d = medicationFacts(L.advil).directions;
    expect(d.blocks.map((b) => b.heading?.text)).toEqual(["Advil Tablets", "Advil Caplets", "Advil Gel Caplets"]);
    const tablets = d.blocks[0].segments;
    expect(tablets.map((s) => s.age)).toEqual([null, "Adults and children 12 years and over", "Children under 12 years"]);
    expect(tablets[1].lines.map((l) => l.text)).toEqual([
      "adults and children 12 years and over: take 1 tablet every 4 to 6 hours while symptoms persist if pain or fever does not respond to 1 tablet, 2 tablets may be used",
      "do not exceed 6 tablets in 24 hours, unless directed by a doctor",
    ]);
    // Already one of the directions lines, so not repeated.
    expect(d.max24h).toBeNull();
  });

  it("Pepcid: a capitalized line ends the adults' card, and label order is kept", () => {
    const s = medicationFacts(L.pepcidAcMax).directions.blocks[0].segments;
    expect(s.map((x) => x.age)).toEqual(["Adults and children 12 years and over", null, "Children under 12 years"]);
    expect(s[1].lines[0].text).toBe("Do not chew.");
  });

  it("Tylenol Extra Strength: directions live in the table; the 24-hour limit gets its own line", () => {
    const d = medicationFacts(L.tylenolExtraStrength).directions;
    expect(d.dosageTableHtml).toBe(L.tylenolExtraStrength.dosageTableHtml);
    expect(d.max24h?.text).toBe("do not take more than 6 tablets in 24 hours");
    expect(d.max24h?.ref).toEqual({ source: "max_24h_text", index: 0 });
    expect(marked(d.max24h!.text)).toEqual(["6 tablets in 24 hours"]);
  });

  it("Children's Tylenol: no age cards of its own; the table is passed whole", () => {
    const d = medicationFacts(L.childrensTylenol).directions;
    expect(d.blocks).toHaveLength(1);
    expect(d.blocks[0].segments.every((s) => s.age === null)).toBe(true);
    expect(d.dosageTableHtml).toBe(L.childrensTylenol.dosageTableHtml);
  });

  it("a row without sections shows its directions text as one unmarked line", () => {
    const d = medicationFacts(calmora).directions;
    expect(d.blocks).toEqual([{ heading: null, segments: [{ age: null, lines: [{ text: calmora.directionsText, ref: { source: "directions_text", index: 0 } }] }] }]);
  });

  it("marks amounts, intervals, 24-hour limits and referrals, nothing else", () => {
    expect(
      marked("adults and children 12 years and over: take 1 tablet every 4 to 6 hours while symptoms persist if pain or fever does not respond to 1 tablet, 2 tablets may be used"),
    ).toEqual(["1 tablet", "every 4 to 6 hours", "1 tablet", "2 tablets"]);
    expect(marked("do not exceed 6 gel caplets in 24 hours, unless directed by a doctor")).toEqual(["6 gel caplets in 24 hours"]);
    expect(marked("take 1 gel caplet every 4 to 6 hours")).toEqual(["1 gel caplet", "every 4 to 6 hours"]);
    expect(marked("children under 12 years: ask a doctor")).toEqual(["ask a doctor"]);
    expect(marked("repeat dose every 4 hours while symptoms last")).toEqual(["every 4 hours"]);
    expect(marked("do not give more than 5 times in 24 hours")).toEqual(["5 times in 24 hours"]);
    expect(marked("take only one dose (2 LiquiCaps) per day (24 hours)")).toEqual(["one dose", "2 LiquiCaps"]);
    expect(marked("shake well before using")).toEqual([]);
  });

  it("marks are sorted, inside the text, and never overlap", () => {
    for (const f of Object.values(L)) {
      for (const b of medicationFacts(f).directions.blocks) {
        for (const l of b.segments.flatMap((s) => s.lines)) {
          const m = l.marks ?? [];
          m.forEach(([s, e], i) => {
            expect(s).toBeGreaterThanOrEqual(0);
            expect(e).toBeLessThanOrEqual(l.text.length);
            expect(s).toBeLessThan(e);
            if (i > 0) expect(s).toBeGreaterThanOrEqual(m[i - 1][1]);
          });
        }
      }
    }
  });
});

describe("warnings", () => {
  const texts = (lines: { text: string }[]) => lines.map((l) => l.text);

  it("Advil: named warnings become cards titled as printed, then the Drug Facts sections", () => {
    const w = medicationFacts(L.advil).warnings;
    const headed = w.filter((c) => c.kind === "headed");
    expect(headed.map((c) => c.title)).toEqual(["Allergy alert", "Stomach bleeding warning", "Heart attack and stroke warning"]);
    expect(headed[1].lead?.text).toBe("This product contains an NSAID, which may cause severe stomach bleeding.");
    expect(texts(headed[1].lines)).toContain("take other drugs containing prescription or non-prescription NSAIDs [aspirin, ibuprofen, naproxen, or others]");
    expect(w.filter((c) => c.kind === "section").map((c) => c.section)).toEqual([
      "do_not_use",
      "ask_doctor",
      "ask_doctor_or_pharmacist",
      "when_using",
      "stop_use",
      "pregnancy_or_breast_feeding",
      "keep_out_of_reach",
    ]);
  });

  it("a heading without a colon still opens a card (Tylenol Extra Strength)", () => {
    const w = medicationFacts(L.tylenolExtraStrength).warnings.filter((c) => c.kind === "headed");
    expect(w.map((c) => c.title)).toEqual(["Liver warning", "Allergy alert"]);
    expect(w[0].lead?.text).toBe("This product contains acetaminophen.");
    expect(texts(w[0].lines)).toContain("3 or more alcoholic drinks every day while using this product");
  });

  it("the overdose warning moves to Took too much?, without its heading", () => {
    expect(texts(medicationFacts(L.tylenolExtraStrength).overdose)).toEqual([
      "In case of overdose, get medical help or contact a Poison Control Center right away. (1-800-222-1222) Quick medical attention is critical for adults as well as for children even if you do not notice any signs or symptoms.",
    ]);
  });

  it("Advil: Keep out of reach's overdose line moves to Took too much?; the heading-only line isn't repeated", () => {
    const x = medicationFacts(L.advil);
    expect(texts(x.overdose)).toEqual(["In case of overdose, get medical help or contact a Poison Control Center right away."]);
    const keep = x.warnings.find((c) => c.section === "keep_out_of_reach");
    expect(keep?.title).toBe("Keep out of reach of children");
    expect(keep?.lines).toEqual([]);
  });

  it("a row without sections shows its warning quotes as one Warnings card", () => {
    const legacy = { ...L.advil, labelSections: {} };
    const w = medicationFacts(legacy).warnings;
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ kind: "headed", title: "Warnings", section: null, lead: null });
    expect(texts(w[0].lines)).toEqual(L.advil.warningsQuotes);
  });

  it("a label with no overdose line still has Took too much? (empty; the card adds Poison Control)", () => {
    expect(medicationFacts({ ...L.advil, labelSections: { uses: ["headache"] }, warningsQuotes: [] }).overdose).toEqual([]);
  });
});
