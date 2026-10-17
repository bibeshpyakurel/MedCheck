import type { NextRequest } from "next/server";
import { z } from "zod";
import { reportFilename } from "@/lib/report/build-report";
import { loadReport, saveExport, timeZoneParam } from "@/lib/report/load-report";
import { renderReportPdf } from "@/lib/report/report-pdf";

// GET /api/patients/:patientId/report.pdf?tz=America/Chicago — the medicine report as a PDF.
// `inline=1` shows it in the browser's PDF viewer (Preview) instead of downloading it.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/patients/[patientId]/report.pdf">) {
  const { patientId } = await ctx.params;
  if (!z.uuid().safeParse(patientId).success) return new Response("Not found", { status: 404 });

  const { searchParams } = request.nextUrl;
  const inline = searchParams.get("inline") === "1";
  const loaded = await loadReport(patientId, { timeZone: timeZoneParam(searchParams.get("tz")) });
  if (!loaded) return new Response("Not found", { status: 404 });
  const { report, runs } = loaded;

  const pdf = await renderReportPdf(report);
  // A preview isn't a report leaving the app, so only downloads and shares are recorded.
  if (!inline) {
    try {
      await saveExport(patientId, report, runs);
    } catch (error) {
      // The user still gets their report; the missing snapshot is logged for us.
      console.error("Could not save export snapshot", error);
    }
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${reportFilename(report)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
