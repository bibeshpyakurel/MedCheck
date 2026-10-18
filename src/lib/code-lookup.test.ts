import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Formulation } from "@/lib/domain/schema";

vi.mock("server-only", () => ({}));

const catalog = vi.hoisted(() => ({ findFormulationsByNdc11: vi.fn() }));
const fda = vi.hoisted(() => ({ packageNdcsForUpc: vi.fn() }));
vi.mock("@/lib/catalog", () => catalog);
vi.mock("@/lib/openfda", () => fda);

import { findFormulationByCodes } from "./code-lookup";

const row = (id: string) => ({ id, brandName: id }) as Formulation;
const tylenol = row("f-tylenol-es");

beforeEach(() => {
  vi.clearAllMocks();
  catalog.findFormulationsByNdc11.mockResolvedValue([]);
  fda.packageNdcsForUpc.mockResolvedValue([]);
});

describe("findFormulationByCodes", () => {
  it("finds the one product a printed NDC belongs to", async () => {
    catalog.findFormulationsByNdc11.mockResolvedValue([tylenol]);
    expect(await findFormulationByCodes(["NDC 50580-0449-10"])).toBe(tylenol);
    expect(catalog.findFormulationsByNdc11).toHaveBeenCalledWith(["50580044910"]);
  });

  it("tries every layout of the 10-digit NDC inside a UPC-A", async () => {
    catalog.findFormulationsByNdc11.mockResolvedValue([tylenol]);
    expect(await findFormulationByCodes(["3 66715 97472 3"])).toBe(tylenol);
    expect(catalog.findFormulationsByNdc11.mock.calls[0][0]).toContain("66715974702");
  });

  it("the same product found by two codes is still one product", async () => {
    catalog.findFormulationsByNdc11.mockResolvedValue([tylenol, row("f-tylenol-es")]);
    expect(await findFormulationByCodes(["NDC 50580-0449-10", "366715974723"])).toBe(tylenol);
  });

  it("two different products: no guess", async () => {
    catalog.findFormulationsByNdc11.mockResolvedValue([tylenol, row("f-other")]);
    expect(await findFormulationByCodes(["NDC 50580-0449-10"])).toBeNull();
    expect(fda.packageNdcsForUpc).not.toHaveBeenCalled();
  });

  it("a UPC our catalog doesn't know is looked up in openFDA's NDC Directory, then in the catalog", async () => {
    // Real Tylenol box: the UPC carries McNeil's old labeler 0045; the label's NDCs are 50580-….
    catalog.findFormulationsByNdc11.mockResolvedValueOnce([]).mockResolvedValueOnce([tylenol]);
    fda.packageNdcsForUpc.mockResolvedValue(["50580093701", "67414044900"]);
    expect(await findFormulationByCodes(["3 00450 44910 8"])).toBe(tylenol);
    expect(fda.packageNdcsForUpc).toHaveBeenCalledWith("0300450449108");
    expect(catalog.findFormulationsByNdc11).toHaveBeenLastCalledWith(["50580093701", "67414044900"]);
  });

  it("an openFDA failure means no match, not an error", async () => {
    fda.packageNdcsForUpc.mockRejectedValue(new Error("timeout"));
    expect(await findFormulationByCodes(["300450449108"])).toBeNull();
  });

  it("nothing readable as a code: no lookups at all", async () => {
    expect(await findFormulationByCodes(["Lot 12345", "EXP 03/2027", ""])).toBeNull();
    expect(await findFormulationByCodes([])).toBeNull();
    expect(catalog.findFormulationsByNdc11).not.toHaveBeenCalled();
    expect(fda.packageNdcsForUpc).not.toHaveBeenCalled();
  });
});
