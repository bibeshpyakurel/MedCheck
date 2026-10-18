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

/** One lookup per distinct ingredient set and form: "acetaminophen+phenylephrine|caplet". */
export function ingredientSetKey(normalized: string[], dosageForm: string): string {
  return `${[...new Set(normalized)].sort().join("+")}|${dosageForm}`;
}

/** Pages for a route the catalog doesn't cover. */
const OTHER_ROUTE = /\b(?:injection|injectable|topical|ophthalmic|eye|nasal|rectal|transdermal|patch|vaginal|otic|ear|inhalation|inhaled|intravenous|implant)\b/i;

/** Form words a page title may name, and the catalog forms each fits. */
const TITLE_FORMS: [RegExp, RegExp][] = [
  [/\bgum\b/i, /gum/],
  [/\blozenges?\b/i, /lozenge/],
  [/\bspray\b/i, /spray/],
  [/\b(?:solution|suspension|liquid|syrup)\b/i, /liquid|mouthwash|rinse/],
  [/\b(?:tablets?|capsules?)\b/i, /tablet|caplet|capsule|softgel|gelcap/],
  [/\bpowder\b/i, /powder|packet|granules/],
];

/** A page naming a form is kept only for that form; a page for another route never is. */
function fitsForm(title: string, dosageForm: string | undefined): boolean {
  if (OTHER_ROUTE.test(title)) return false;
  for (const [word, forms] of TITLE_FORMS) if (word.test(title)) return dosageForm !== undefined && forms.test(dosageForm);
  return true;
}

const DRUG_PAGE = /^https:\/\/medlineplus\.gov\/druginfo\/meds\/[a-z0-9]+\.html$/;

/** The drug-information pages in a Connect response (untrusted JSON) that fit the product's form. */
export function medlinePlusLinks(response: unknown, dosageForm?: string): SourceLink[] {
  const entries = (response as { feed?: { entry?: unknown } } | null)?.feed?.entry;
  if (!Array.isArray(entries)) return [];
  const links: SourceLink[] = [];
  for (const entry of entries) {
    const title = (entry as { title?: { _value?: unknown } })?.title?._value;
    const hrefs = (entry as { link?: { href?: unknown }[] })?.link;
    if (typeof title !== "string" || !title.trim() || !Array.isArray(hrefs) || !fitsForm(title, dosageForm)) continue;
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
