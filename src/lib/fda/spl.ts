// DailyMed SPL XML → the label's own block structure (titles, paragraphs, list items) per Drug Facts
// section. Pure; parse-only (htmlparser2 in XML mode, nothing is executed or fetched). Used only to know
// where the label's own bullets begin and end: bullet text is still cut from the openFDA label text.
import { Parser } from "htmlparser2";
import type { LabelSectionKey } from "@/lib/domain/schema";

/** LOINC section codes (FDA SPL) → card sections. */
const SECTION_CODES: Record<string, LabelSectionKey> = {
  "34067-9": "uses", // INDICATIONS & USAGE
  "55105-1": "purpose",
  "34068-7": "directions", // DOSAGE & ADMINISTRATION
  "50570-1": "do_not_use",
  "50569-3": "ask_doctor",
  "50568-5": "ask_doctor_or_pharmacist",
  "50567-7": "when_using",
  "50566-9": "stop_use",
  "53414-9": "pregnancy_or_breast_feeding",
  "34071-1": "warnings",
  "50565-1": "keep_out_of_reach",
  "51727-6": "inactive_ingredients",
  "44425-7": "storage",
  "60561-8": "other_information", // OTHER SAFETY INFORMATION
  "53413-1": "questions",
};

const BLOCK_TAGS = new Set(["title", "paragraph", "item", "td", "th", "caption"]);

export type SplBlock = { text: string; keys: LabelSectionKey[]; title: boolean };

export type SplSections = {
  documentId: string | null;
  setId: string | null;
  /** Every block in document order, with the card sections it sits in (innermost last). */
  blocks: SplBlock[];
};

export function splUrl(setId: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(setId)) throw new Error(`not a set id: ${setId}`);
  return `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${setId}.xml`;
}

export function parseSpl(xml: string): SplSections {
  const result: SplSections = { documentId: null, setId: null, blocks: [] };
  const tags: string[] = [];
  const sections: (LabelSectionKey | null)[] = [];
  let buffer = "";
  let blockIsTitle = false;
  let sawDocument = false;

  const keys = () => sections.filter((k): k is LabelSectionKey => k !== null);
  const flush = () => {
    const text = buffer.replace(/\s+/g, " ").trim();
    buffer = "";
    if (text && keys().length > 0) result.blocks.push({ text, keys: [...new Set(keys())], title: blockIsTitle });
    blockIsTitle = false;
  };

  const parser = new Parser(
    {
      onopentag(name, attrs) {
        const parent = tags[tags.length - 1];
        tags.push(name);
        if (name === "document" && tags.length === 1) sawDocument = true;
        if (!sawDocument) return;
        if (name === "id" && parent === "document" && !result.documentId) result.documentId = attrs.root ?? null;
        if (name === "setId" && parent === "document") result.setId = attrs.root ?? null;
        if (name === "section") {
          flush();
          sections.push(null);
        }
        if (name === "code" && parent === "section" && sections.length > 0) {
          sections[sections.length - 1] = SECTION_CODES[attrs.code ?? ""] ?? null;
        }
        if (BLOCK_TAGS.has(name) || name === "br") {
          flush();
          blockIsTitle = name === "title" && parent === "section";
        }
      },
      ontext(text) {
        if (sawDocument && sections.length > 0) buffer += text;
      },
      onclosetag(name) {
        tags.pop();
        if (!sawDocument) return;
        if (BLOCK_TAGS.has(name)) flush();
        if (name === "section") {
          flush();
          sections.pop();
        }
      },
    },
    { xmlMode: true, decodeEntities: true },
  );
  parser.write(xml);
  parser.end();
  return sawDocument ? result : { documentId: null, setId: null, blocks: [] };
}
