// Turns raw history rows (JSON snapshots written by DB triggers) into readable lines. Pure.
import type { SourceDocumentKind } from "@/lib/domain/schema";
import { DOCUMENT_KIND_LABELS } from "@/lib/record-format";

export type HistoryEvent = {
  id: number;
  entity: string;
  entityId: string;
  action: "insert" | "update" | "delete";
  before: unknown;
  after: unknown;
  at: string;
};

type Row = Record<string, unknown>;
const asRow = (v: unknown): Row => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

function medicineName(row: Row): string {
  const product = asRow(asRow(row.fields).productName);
  return str(product.value) ?? str(product.aiValue) ?? "Unnamed medicine";
}

export function describeHistory(e: HistoryEvent): { title: string; detail: string | null } {
  const before = asRow(e.before);
  const after = asRow(e.after);
  const current = e.action === "delete" ? before : after;

  if (e.entity === "medication_entries") {
    const name = medicineName(current);
    if (e.action === "delete") return { title: `Medicine removed: ${name}`, detail: null };
    if (e.action === "insert") {
      return {
        title: after.status === "confirmed" ? `Medicine added: ${name}` : `Medicine added for review: ${name}`,
        detail: null,
      };
    }
    if (before.status !== "confirmed" && after.status === "confirmed") return { title: `Medicine confirmed: ${name}`, detail: null };
    return { title: `Medicine details changed: ${name}`, detail: null };
  }

  if (e.entity === "source_documents") {
    const kind = DOCUMENT_KIND_LABELS[current.kind as SourceDocumentKind] ?? "Document";
    const detail =
      [str(current.facility), str(current.pharmacy), str(current.prescriber), str(current.document_date)]
        .filter(Boolean)
        .join(" · ") || null;
    const verb = e.action === "insert" ? "added" : e.action === "delete" ? "removed" : "details changed";
    return { title: `Document ${verb}: ${kind}`, detail };
  }

  if (e.entity === "patients") {
    const name = str(current.display_name) ?? "profile";
    if (e.action === "insert") return { title: `Profile created: ${name}`, detail: null };
    const oldName = str(before.display_name);
    if (e.action === "update" && oldName && oldName !== name) return { title: `Profile renamed: ${oldName} → ${name}`, detail: null };
    return { title: `Profile ${e.action === "delete" ? "removed" : "updated"}: ${name}`, detail: null };
  }

  return { title: `Record ${e.action === "insert" ? "added" : e.action === "delete" ? "removed" : "changed"}`, detail: null };
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "just now", "5 minutes ago", "yesterday", "last week". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(seconds / 86400), "day");
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / (86400 * 7)), "week");
  return rtf.format(Math.round(seconds / (86400 * 30)), "month");
}
