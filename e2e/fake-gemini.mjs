// A local stand-in for Gemini's generateContent endpoint, for the e2e tests only. The app reaches it
// through GOOGLE_GENERATIVE_AI_BASE_URL (playwright.config.ts). It answers with a canned label read
// chosen by the uploaded photo's width (fake-gemini-scenarios.mjs), so tests never depend on a model.
import { createServer } from "node:http";
import { FAKE_GEMINI_PORT, SCENARIO_WIDTHS } from "./fake-gemini-scenarios.mjs";

const text = (value) => ({ value, box_2d: null });
const noStrength = { amount: null, unit: null, perAmount: null, perUnit: null, box_2d: null };
const noDocument = { documentDate: null, facility: null, prescriber: null, pharmacy: null };
const medication = (m) => ({
  productName: text(m.productName ?? null),
  dosageForm: text(m.dosageForm ?? null),
  ingredients: m.ingredients ?? [],
  instructions: text(null),
  doseAsWritten: { amount: null, unit: null, box_2d: null },
  max24h: text(null),
});

const READS = {
  [SCENARIO_WIDTHS.tylenolExtraStrength]: {
    document: noDocument,
    medications: [
      medication({
        productName: "TYLENOL Extra Strength",
        dosageForm: "caplets",
        ingredients: [
          { name: text("Acetaminophen"), strength: { amount: 500, unit: "mg", perAmount: 1, perUnit: "caplet", box_2d: null } },
        ],
      }),
    ],
  },
  [SCENARIO_WIDTHS.unreadable]: {
    document: noDocument,
    medications: [medication({ ingredients: [{ name: text(null), strength: noStrength }] })],
  },
};
const NOTHING_FOUND = { document: noDocument, medications: [] };

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
