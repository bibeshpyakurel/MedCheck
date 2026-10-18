import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSpl, splUrl } from "./spl";

const xml = (name: string) => readFileSync(path.join(__dirname, "__fixtures__", name), "utf8");

describe("parseSpl — DailyMed SPL XML → the label's own list structure", () => {
  const spl = parseSpl(xml("spl-ibuprofen-dye-free.xml"));

  it("reads the document ids", () => {
    expect(spl.setId).toBe("d0eff659-6445-a56a-e053-2995a90a72e9");
    expect(spl.documentId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps each <item> as its own block, under its section", () => {
    const doNotUse = spl.blocks.filter((b) => b.keys.includes("do_not_use")).map((b) => b.text);
    expect(doNotUse).toEqual([
      "Do not use",
      "if you have ever had an allergic reaction to any other pain reliever/fever reducer",
      "right before or after heart surgery",
    ]);
    expect(spl.blocks.find((b) => b.text === "Do not use")?.title).toBe(true);
  });

  it("nests subsections under Warnings", () => {
    const block = spl.blocks.find((b) => b.text === "right before or after heart surgery")!;
    expect(block.keys).toContain("warnings");
    expect(block.keys).toContain("do_not_use");
  });

  it("ignores anything that isn't a document (untrusted input)", () => {
    expect(parseSpl("not xml at all").blocks).toEqual([]);
    expect(parseSpl("<script>alert(1)</script>").blocks).toEqual([]);
  });

  it("builds the DailyMed service URL only for a set id", () => {
    expect(splUrl("d0eff659-6445-a56a-e053-2995a90a72e9")).toBe(
      "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/d0eff659-6445-a56a-e053-2995a90a72e9.xml",
    );
    expect(() => splUrl("../etc/passwd")).toThrow();
  });
});
