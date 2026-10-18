// A local stand-in for Gemini's generateContent endpoint, for the e2e tests only. The app reaches it
// through GOOGLE_GENERATIVE_AI_BASE_URL (playwright.config.ts). It answers with a canned label read,
// including what kind of photo it is (`documentKind`), chosen by the uploaded photo's width
// (fake-gemini-scenarios.mjs), so tests never depend on a model.
import { createServer } from "node:http";
import { FAKE_GEMINI_PORT, SCENARIO_WIDTHS } from "./fake-gemini-scenarios.mjs";

const text = (value) => ({ value, box_2d: null });
const noStrength = { amount: null, unit: null, perAmount: null, perUnit: null, box_2d: null };
const noDocument = { documentDate: null, facility: null, prescriber: null, pharmacy: null };
const medication = (m) => ({
  productName: text(m.productName ?? null),
  dosageForm: text(m.dosageForm ?? null),
  ingredients: m.ingredients ?? [],
  instructions: text(m.instructions ?? null),
  doseAsWritten: { amount: m.dose?.amount ?? null, unit: m.dose?.unit ?? null, box_2d: null },
  max24h: text(m.max24h ?? null),
  codes: m.codes ?? [],
});
const ingredient = (name, amount, perUnit) => ({
  name: text(name),
  strength: { amount, unit: "mg", perAmount: 1, perUnit, box_2d: null },
});

const tylenolExtraStrength = medication({
  productName: "TYLENOL Extra Strength",
  dosageForm: "caplets",
  ingredients: [ingredient("Acetaminophen", 500, "caplet")],
});

const READS = {
  [SCENARIO_WIDTHS.tylenolExtraStrength]: { documentKind: "otc_package", document: noDocument, medications: [tylenolExtraStrength] },
  [SCENARIO_WIDTHS.unreadable]: {
    documentKind: "otc_package",
    document: noDocument,
    medications: [medication({ ingredients: [{ name: text(null), strength: noStrength }] })],
    photoIssue: "glare",
  },
  [SCENARIO_WIDTHS.advilAndTylenol]: {
    documentKind: "otc_package",
    document: noDocument,
    medications: [
      medication({ productName: "Advil", dosageForm: "tablets", ingredients: [ingredient("Ibuprofen", 200, "tablet")] }),
      tylenolExtraStrength,
    ],
  },
  [SCENARIO_WIDTHS.prescriptionLabel]: {
    documentKind: "prescription_label",
    document: { documentDate: "2026-10-15", facility: null, prescriber: "Dr. Maria Rivera", pharmacy: "Lakeside Pharmacy" },
    medications: [
      medication({
        productName: "Amoxicillin",
        dosageForm: "capsule",
        ingredients: [ingredient("Amoxicillin", 500, "capsule")],
        instructions: "Take 1 capsule by mouth every 8 hours until gone",
        dose: { amount: 1, unit: "capsule" },
      }),
    ],
  },
  [SCENARIO_WIDTHS.prescriptionNothingRead]: { documentKind: "prescription_label", document: noDocument, medications: [] },
  [SCENARIO_WIDTHS.tylenolByCode]: {
    documentKind: "otc_package",
    document: noDocument,
    medications: [medication({ codes: ["NDC 50580-449-10"] })],
  },
};
// Gemini isn't sure what an empty photo shows.
const NOTHING_FOUND = { documentKind: null, document: noDocument, medications: [], photoIssue: null };

/** Width of a JPEG (SOFn marker) or PNG (IHDR), or null. */
function imageWidth(bytes) {
  if (bytes[0] === 0x89 && bytes.toString("ascii", 1, 4) === "PNG") return bytes.readUInt32BE(16);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    const length = bytes.readUInt16BE(i + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof) return bytes.readUInt16BE(i + 7);
    i += 2 + length;
  }
  return null;
}

function photoWidth(body) {
  for (const content of body.contents ?? []) {
    for (const part of content.parts ?? []) {
      const data = part.inlineData?.data ?? part.inline_data?.data;
      if (data) return imageWidth(Buffer.from(data, "base64"));
    }
  }
  return null;
}

const server = createServer((req, res) => {
  if (req.method === "GET") {
    res.writeHead(200, { "content-type": "text/plain" }).end("fake gemini");
    return;
  }
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    if (!req.url?.includes(":generateContent")) {
      res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: { message: "not faked" } }));
      return;
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    const read = READS[photoWidth(body)] ?? NOTHING_FOUND;
    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({
        candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(read) }] }, finishReason: "STOP", index: 0 }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
        modelVersion: "fake-gemini",
      }),
    );
  });
});

server.listen(FAKE_GEMINI_PORT, () => console.log(`fake Gemini on http://localhost:${FAKE_GEMINI_PORT}`));
