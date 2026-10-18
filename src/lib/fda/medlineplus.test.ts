import { describe, expect, it } from "vitest";
import responses from "./__fixtures__/medlineplus-connect.json";
import { ingredientSetKey, medlinePlusLinks, medlinePlusQueryUrl } from "./medlineplus";

describe("MedlinePlus Connect", () => {
  it("queries by package NDC", () => {
    const url = new URL(medlinePlusQueryUrl("37000-523-02"));
    expect(url.origin).toBe("https://connect.medlineplus.gov");
    expect(url.searchParams.get("mainSearchCriteria.v.cs")).toBe("2.16.840.1.113883.6.69");
    expect(url.searchParams.get("mainSearchCriteria.v.c")).toBe("37000-523-02");
    expect(url.searchParams.get("knowledgeResponseType")).toBe("application/json");
  });

  it("keeps one drug-information page per ingredient, as a plain link", () => {
    expect(medlinePlusLinks(responses["nyquil-37000-523-02"])).toEqual([
      { label: "MedlinePlus: Acetaminophen", url: "https://medlineplus.gov/druginfo/meds/a681004.html" },
      { label: "MedlinePlus: Dextromethorphan", url: "https://medlineplus.gov/druginfo/meds/a682492.html" },
      { label: "MedlinePlus: Doxylamine", url: "https://medlineplus.gov/druginfo/meds/a682537.html" },
      { label: "MedlinePlus: Phenylephrine", url: "https://medlineplus.gov/druginfo/meds/a606008.html" },
    ]);
  });

  it("drops health-topic pages and anything not on medlineplus.gov", () => {
    expect(medlinePlusLinks(responses["tylenol-50580-590-02"])).toEqual([
      { label: "MedlinePlus: Acetaminophen", url: "https://medlineplus.gov/druginfo/meds/a681004.html" },
    ]);
    const hostile = { feed: { entry: [{ title: { _value: "X" }, link: [{ href: "https://evil.example/druginfo/meds/a1.html" }] }] } };
    expect(medlinePlusLinks(hostile)).toEqual([]);
    expect(medlinePlusLinks(null)).toEqual([]);
    expect(medlinePlusLinks({ feed: "nope" })).toEqual([]);
  });

  it("keys a product by its sorted normalized ingredients and its form", () => {
    expect(ingredientSetKey(["phenylephrine", "acetaminophen"], "caplet")).toBe("acetaminophen+phenylephrine|caplet");
  });

  const feed = (...titles: string[]) => ({
    feed: { entry: titles.map((t, i) => ({ title: { _value: t }, link: [{ href: `https://medlineplus.gov/druginfo/meds/a60${i}.html` }] })) },
  });

  it("drops pages for another route or form, keeping the plain ingredient page", () => {
    const links = medlinePlusLinks(feed("Nicotine Transdermal Patch", "Nicotine Nasal Spray", "Nicotine Gum", "Nicotine Lozenges", "Nicotine"), "lozenge");
    expect(links.map((l) => l.label)).toEqual(["MedlinePlus: Nicotine Lozenges", "MedlinePlus: Nicotine"]);
    expect(medlinePlusLinks(feed("Nicotine Gum"), "lozenge")).toEqual([]);
    expect(medlinePlusLinks(feed("Diphenhydramine Injection", "Diphenhydramine Topical", "Diphenhydramine"), "softgel").map((l) => l.label)).toEqual([
      "MedlinePlus: Diphenhydramine",
    ]);
  });
});
