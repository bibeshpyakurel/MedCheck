import { writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { VITALS_NOTE } from "@/lib/vitals";
import { emptyReport, pendingOnlyReport, sampleReport, sampleVitals } from "./__fixtures__/sample-report";
import { BOUNDARY_STATEMENT } from "./build-report";
import { renderReportPdf } from "./report-pdf";

/** The text drawn on the pages: inflates each content stream and decodes its hex text runs. */
function pdfText(pdf: Buffer): string {
  const raw = pdf.toString("latin1");
  const lines: string[] = [];
  for (const m of raw.matchAll(/stream\r?\n/g)) {
    const start = m.index + m[0].length;
    let content: string;
    try {
      content = inflateSync(pdf.subarray(start, raw.indexOf("endstream", start))).toString("latin1");
    } catch {
      continue; // not a deflated content stream (e.g. metadata)
    }
    for (const run of content.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      const hex = [...run[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((h) => h[1]).join("");
      lines.push(Buffer.from(hex, "hex").toString("latin1"));
    }
  }
  return lines.join(" ").replace(/\s+/g, " ");
}

const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;

// Set REPORT_PDF_OUT=/path/to/dir to keep the rendered samples for a visual check.
const keep = (name: string, pdf: Buffer) => {
  if (process.env.REPORT_PDF_OUT) writeFileSync(`${process.env.REPORT_PDF_OUT}/${name}.pdf`, pdf);
};

describe("renderReportPdf", () => {
  it("renders the medicines, the warnings with their evidence, and what isn't confirmed yet", async () => {
    const pdf = await renderReportPdf(sampleReport());
    keep("sample", pdf);
    expect(pdf.toString("latin1").startsWith("%PDF-")).toBe(true);
    const text = pdfText(pdf);
    expect(text).toContain("Medicine report for Sam");
    expect(text).toContain("Medicines");
    expect(text).toContain("Calmora Extra Fever Relief");
    expect(text).toContain("Warnings");
    expect(text).toContain("Two products contain acetaminophen");
    expect(text).toContain("The label says");
    expect(text).toContain("Not yet confirmed");
    expect(text).toContain("1 medicine is waiting for you to check its details.");
    expect(text).toContain("maximum unreadable on the Drug Facts photo");
    expect(text).toContain("Evidence, not advice");
  }, 20_000);

  it("adds the latest vitals as an estimate, with each line's confidence and the note", async () => {
    const pdf = await renderReportPdf(sampleReport(sampleVitals));
    keep("vitals", pdf);
    const text = pdfText(pdf);
    expect(text).toContain("Vitals (estimate)");
    expect(text).toMatch(/Measured Oct(ober)? 17, 2026, 1:40 PM CDT/);
    expect(text).toContain("Heart rate");
    expect(text).toContain("72 bpm");
    expect(text).toContain("92% confidence");
    expect(text).toContain("Breathing rate");
    expect(text).toContain("read clearly");
    expect(text).toContain(VITALS_NOTE.slice(0, 40));
    expect(text).not.toMatch(/normal|\bhigh\b|\blow\b|\bsafe/i);
  }, 20_000);

  it("has no vitals section without a reading", async () => {
    expect(pdfText(await renderReportPdf(sampleReport()))).not.toContain("Vitals");
  }, 20_000);

  it("has no pharmacist framing, questions, check listings or demo labels", async () => {
    // Label text is quoted as printed, so only the report's own wording is checked here.
    const text = pdfText(await renderReportPdf(sampleReport()));
    expect(text).not.toMatch(/pharmacist report|questions? (to ask|for your)|ask: |checks run|demo data|synthetic|poison control/i);
    expect(text).not.toMatch(/bring this|what the checks found|\bsafe/i);
  }, 20_000);

  it("renders a clean one-page report when nothing has been added yet", async () => {
    const pdf = await renderReportPdf(emptyReport());
    keep("empty", pdf);
    const text = pdfText(pdf);
    expect(pageCount(pdf)).toBe(1);
    expect(text).toContain("Medicine report");
    expect(text).toContain("No medicines yet");
    expect(text).not.toContain("Warnings");
    expect(text).toContain(BOUNDARY_STATEMENT.slice(0, 20));
  }, 20_000);

  it("says plainly when medicines are added but none confirmed", async () => {
    const pdf = await renderReportPdf(pendingOnlyReport());
    keep("pending", pdf);
    const text = pdfText(pdf);
    expect(text).toContain("No confirmed medicines yet");
    expect(text).toContain("2 medicines are waiting for you to check their details.");
  }, 20_000);
});
