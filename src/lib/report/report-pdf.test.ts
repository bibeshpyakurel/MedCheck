import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sampleReport } from "./__fixtures__/sample-report";
import { renderReportPdf } from "./report-pdf";

describe("renderReportPdf", () => {
  // Set REPORT_PDF_OUT=/path/to/sample.pdf to keep the rendered sample for a visual check.
  it("renders the sample report to a PDF titled after the patient", async () => {
    const pdf = await renderReportPdf(sampleReport());
    if (process.env.REPORT_PDF_OUT) writeFileSync(process.env.REPORT_PDF_OUT, pdf);
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(text).toContain("MedCheck report for Sam");
    expect(pdf.length).toBeGreaterThan(5_000);
  }, 20_000);
});
