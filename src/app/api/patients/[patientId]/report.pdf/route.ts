import type { NextRequest } from "next/server";
import { z } from "zod";
import { reportFilename } from "@/lib/report/build-report";
import { loadReport, saveExport, timeZoneParam } from "@/lib/report/load-report";
import { renderReportPdf } from "@/lib/report/report-pdf";

// GET /api/patients/:patientId/report.pdf?tz=America/Chicago — the medicine report as a PDF download.
// (The preview is a page, /patients/:patientId/export/preview, drawn from the same report.)
export async function GET(request: NextRequest, ctx: RouteContext<"/api/patients/[patientId]/report.pdf">) {
  const { patientId } = await ctx.params;
  if (!z.uuid().safeParse(patientId).success) return new Response("Not found", { status: 404 });

  const { searchParams } = request.nextUrl;
  const loaded = await loadReport(patientId, { timeZone: timeZoneParam(searchParams.get("tz")) });
  if (!loaded) return new Response("Not found", { status: 404 });
  const { report, runs } = loaded;

  const pdf = await renderReportPdf(report);
  // Every PDF is a download or a share: a report leaving the app, so it's recorded.
  try {
    await saveExport(patientId, report, runs);
  } catch (error) {
    // The user still gets their report; the missing snapshot is logged for us.
    console.error("Could not save export snapshot", error);
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${reportFilename(report)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
