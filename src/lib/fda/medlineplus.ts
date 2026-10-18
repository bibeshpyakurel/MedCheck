// MedlinePlus (NIH) drug-information links for the card's Sources. Pure: builds the MedlinePlus Connect
// query and reads its JSON answer. Links only — MedlinePlus text is licensed and never copied.
import type { SourceLink } from "@/lib/domain/schema";

const CONNECT = "https://connect.medlineplus.gov/service";
const NDC_CODE_SYSTEM = "2.16.840.1.113883.6.69";

/** MedlinePlus Connect lookup for one package NDC ("37000-523-02"). */
export function medlinePlusQueryUrl(packageNdc: string): string {
  const params = new URLSearchParams({
    "mainSearchCriteria.v.cs": NDC_CODE_SYSTEM,
    "mainSearchCriteria.v.c": packageNdc,
    knowledgeResponseType: "application/json",
  });
  return `${CONNECT}?${params}`;
}

/** One lookup per distinct ingredient set: "acetaminophen+phenylephrine". */
export function ingredientSetKey(normalized: string[]): string {
  return [...new Set(normalized)].sort().join("+");
}

const DRUG_PAGE = /^https:\/\/medlineplus\.gov\/druginfo\/meds\/[a-z0-9]+\.html$/;

/** The drug-information pages in a Connect response (untrusted JSON), as plain https links. */
export function medlinePlusLinks(response: unknown): SourceLink[] {
  const entries = (response as { feed?: { entry?: unknown } } | null)?.feed?.entry;
  if (!Array.isArray(entries)) return [];
  const links: SourceLink[] = [];
  for (const entry of entries) {
    const title = (entry as { title?: { _value?: unknown } })?.title?._value;
    const hrefs = (entry as { link?: { href?: unknown }[] })?.link;
    if (typeof title !== "string" || !title.trim() || !Array.isArray(hrefs)) continue;
    for (const link of hrefs) {
      if (typeof link?.href !== "string") continue;
      let url: URL;
      try {
        url = new URL(link.href);
      } catch {
        continue;
      }
      const clean = `${url.origin}${url.pathname}`;
      if (!DRUG_PAGE.test(clean) || links.some((l) => l.url === clean)) continue;
      links.push({ label: `MedlinePlus: ${title.trim()}`, url: clean });
    }
  }
  return links;
}
