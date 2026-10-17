import type { NextRequest } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { reportFilename } from "@/lib/report/build-report";
import { EMAIL_DAILY_LIMIT, isEmailConfigured } from "@/lib/report/email-config";
import { loadReport, saveExport, timeZoneParam } from "@/lib/report/load-report";
import { renderReportPdf } from "@/lib/report/report-pdf";
import { getCaregiver, upsertCaregiver } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  to: z.email("Enter a valid email address").max(254),
  subject: z.string().trim().min(1, "Add a subject").max(200),
  body: z.string().max(10_000),
  timeZone: z.string().optional(),
});

const error = (status: number, message: string) => Response.json({ ok: false, error: message }, { status });

// POST /api/patients/:patientId/email — sends the report PDF with Resend. 5 sends per caregiver per 24 h.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/patients/[patientId]/email">) {
  const { patientId } = await ctx.params;
  if (!isEmailConfigured()) {
    return error(501, "Email isn't set up for this MedCheck. Use Share or Download PDF and send it yourself.");
  }
  if (!z.uuid().safeParse(patientId).success) return error(404, "Patient not found");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(400, parsed.error.issues[0]?.message ?? "Check the form and try again");
  const { to, subject, body, timeZone } = parsed.data;

  const loaded = await loadReport(patientId, { timeZone: timeZoneParam(timeZone) });
  if (!loaded) return error(404, "Patient not found");
  const { report, runs } = loaded;

  const caregiver = (await getCaregiver()) ?? (await upsertCaregiver());
  const supabase = await createClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("email_sends")
    .select("id", { count: "exact", head: true })
    .eq("caregiver_id", caregiver.id)
    .gte("sent_at", since);
  if (countError) throw countError;
  if ((count ?? 0) >= EMAIL_DAILY_LIMIT) {
    return error(
      429,
      `You've emailed ${EMAIL_DAILY_LIMIT} reports in the last 24 hours, the daily limit. Use Share or Download PDF instead.`,
    );
  }

  const pdf = await renderReportPdf(report);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error: sendError } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject,
    text: body,
    attachments: [{ filename: reportFilename(report), content: pdf, contentType: "application/pdf" }],
  });
  if (sendError) {
    console.error("Resend send failed", sendError);
    return error(502, "The email couldn't be sent. Try again, or use Share or Download PDF.");
  }

  const exportId = await saveExport(patientId, report, runs).catch((e: unknown) => {
    console.error("Could not save export snapshot", e);
    return null;
  });
  const { error: logError } = await supabase
    .from("email_sends")
    .insert({ caregiver_id: caregiver.id, export_id: exportId, to_address: to });
  if (logError) console.error("Could not record email send", logError);

  return Response.json({ ok: true });
}
