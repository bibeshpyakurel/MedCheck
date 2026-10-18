// The medicine report as a PDF (react-pdf). Built-in Helvetica only — no remote fonts, so it
// renders the same on Vercel and locally. Stick to WinAnsi characters (no ≥, ✓, emoji).
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { NO_WARNINGS, type Report, type ReportMedicine, type ReportWarning } from "./build-report";

const c = {
  teal: "#2b7a78",
  tealDark: "#1f5c5a",
  ink: "#1d2b33",
  muted: "#5b6b75",
  rule: "#dde5e8",
  amber: "#d08a1c",
  amberInk: "#7a4d0b",
  amberRule: "#ecdcbc",
  amberSurface: "#fdf6e7",
  violet: "#6b5bb5",
  violetSurface: "#f3f1fb",
  neutralSurface: "#f2f4f5",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: c.ink,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { flexDirection: "row", alignItems: "center" },
  mark: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: c.teal,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    textAlign: "center",
    paddingTop: 4,
    marginRight: 8,
  },
  wordmark: { fontFamily: "Helvetica-Bold", fontSize: 16, color: c.ink, letterSpacing: -0.3 },
  headerRight: { alignItems: "flex-end" },
  kicker: { fontFamily: "Helvetica-Bold", fontSize: 9, color: c.teal, letterSpacing: 1, textTransform: "uppercase" },
  small: { fontSize: 9, color: c.muted },
  headerRule: { height: 2, backgroundColor: c.teal, marginTop: 12, marginBottom: 18 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 22, letterSpacing: -0.4 },
  meta: { fontSize: 10.5, color: c.muted, marginTop: 3 },
  section: { marginTop: 22 },
  h2: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13.5,
    color: c.tealDark,
    paddingBottom: 4,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.rule,
  },
  empty: { color: c.muted, fontFamily: "Helvetica-Oblique" },
  emptyBox: { marginTop: 22, borderRadius: 8, backgroundColor: c.neutralSurface, padding: 18 },
  emptyTitle: { fontFamily: "Helvetica-Bold", fontSize: 14 },
  emptyText: { marginTop: 4, color: c.muted, lineHeight: 1.4 },
  card: {
    borderLeftWidth: 3,
    borderLeftColor: c.amber,
    backgroundColor: c.amberSurface,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  cardTitle: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  cardDetail: { marginTop: 3, lineHeight: 1.4 },
  table: { marginTop: 8, borderTopWidth: 1, borderTopColor: c.amberRule },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.amberRule, paddingVertical: 4 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: c.amberInk, textTransform: "uppercase", letterSpacing: 0.5 },
  td: { fontSize: 10 },
  colProduct: { width: "34%", paddingRight: 6 },
  colSource: { width: "33%", paddingRight: 6 },
  colValue: { width: "33%" },
  quote: { marginTop: 8, paddingLeft: 8, borderLeftWidth: 1.5, borderLeftColor: "#e3c58f" },
  quoteLabel: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: c.amberInk },
  quoteText: { fontFamily: "Helvetica-Oblique", fontSize: 10, marginTop: 1, lineHeight: 1.4 },
  med: { borderWidth: 1, borderColor: c.rule, borderRadius: 6, padding: 10, marginBottom: 8 },
  medName: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  medSource: { fontSize: 9, color: c.muted, marginTop: 1 },
  dl: { flexDirection: "row", marginTop: 4 },
  dt: { width: 92, fontSize: 9, color: c.muted, paddingTop: 1 },
  dd: { flex: 1, fontSize: 10.5, lineHeight: 1.35 },
  pending: { backgroundColor: c.violetSurface, borderRadius: 6, padding: 12 },
  pendingText: { fontSize: 10.5, lineHeight: 1.4 },
  bullet: { fontSize: 10, color: c.violet, marginTop: 3, lineHeight: 1.35 },
  vitals: { backgroundColor: c.neutralSurface, borderRadius: 6, padding: 12 },
  vitalRow: { flexDirection: "row", marginTop: 4 },
  vitalValue: { flex: 1, fontSize: 10.5 },
  vitalConfidence: { fontSize: 9, color: c.muted, paddingTop: 1 },
  vitalNote: { marginTop: 8, fontSize: 9, color: c.muted, lineHeight: 1.35 },
  boundary: { marginTop: 24, fontSize: 9, color: c.muted },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8.5,
    color: c.muted,
    borderTopWidth: 1,
    borderTopColor: c.rule,
    paddingTop: 6,
  },
});

function WarningCard({ warning }: { warning: ReportWarning }) {
  return (
    <View style={s.card} wrap={false}>
      <Text style={s.cardTitle}>{warning.title}</Text>
      <Text style={s.cardDetail}>{warning.detail}</Text>
      {warning.evidence.length > 0 && (
        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, s.colProduct]}>Medicine</Text>
            <Text style={[s.th, s.colSource]}>Where</Text>
            <Text style={[s.th, s.colValue]}>What it says</Text>
          </View>
          {warning.evidence.map((e, i) => (
            <View key={i} style={s.tr}>
              <Text style={[s.td, s.colProduct]}>{e.product}</Text>
              <Text style={[s.td, s.colSource]}>{e.source}</Text>
              <Text style={[s.td, s.colValue]}>
                {e.field}: {e.value}
              </Text>
            </View>
          ))}
        </View>
      )}
      {warning.labelWarningQuote && (
        <View style={s.quote}>
          <Text style={s.quoteLabel}>The label says</Text>
          <Text style={s.quoteText}>&ldquo;{warning.labelWarningQuote}&rdquo;</Text>
        </View>
      )}
    </View>
  );
}

function Medicine({ medicine }: { medicine: ReportMedicine }) {
  const rows: [string, string][] = [
    ["Active ingredients", medicine.ingredients.join("; ") || "None recorded"],
    ["Form", medicine.dosageForm],
    ["Instructions", medicine.instructions],
    ["Dose as written", medicine.doseAsWritten],
    ["24-hour maximum", medicine.max24h],
  ];
  return (
    <View style={s.med} wrap={false}>
      <Text style={s.medName}>{medicine.name}</Text>
      <Text style={s.medSource}>{medicine.source}</Text>
      {rows.map(([label, value]) => (
        <View key={label} style={s.dl}>
          <Text style={s.dt}>{label}</Text>
          <Text style={s.dd}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

/** A section whose heading stays on the same page as its first item. */
function Section({ title, items }: { title: string; items: ReactNode[] }) {
  return (
    <View style={s.section}>
      <View wrap={false}>
        <Text style={s.h2}>{title}</Text>
        {items[0]}
      </View>
      {items.slice(1)}
    </View>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function NotYetConfirmed({ report }: { report: Report }) {
  if (!report.pendingNote && report.notCompared.length === 0) return null;
  return (
    <Section
      title="Not yet confirmed"
      items={[
        <View key="pending" style={s.pending} wrap={false}>
          {report.pendingNote && <Text style={s.pendingText}>{report.pendingNote}</Text>}
          {report.notCompared.length > 0 && (
            <>
              <Text style={[s.pendingText, report.pendingNote ? { marginTop: 6 } : {}]}>
                These details are missing or couldn&apos;t be read, so they weren&apos;t compared:
              </Text>
              {report.notCompared.map((reason, i) => (
                <Text key={i} style={s.bullet}>
                  - {reason}
                </Text>
              ))}
            </>
          )}
        </View>,
      ]}
    />
  );
}

/** The latest vitals scan, in neutral colours: numbers and confidence only, never a judgement. */
function Vitals({ report }: { report: Report }) {
  if (!report.vitals) return null;
  return (
    <Section
      title="Vitals (estimate)"
      items={[
        <View key="vitals" style={s.vitals} wrap={false}>
          <Text style={s.small}>Measured {report.vitals.measuredAtLabel}</Text>
          {report.vitals.lines.map((l) => (
            <View key={l.label} style={s.vitalRow}>
              <Text style={s.dt}>{l.label}</Text>
              <Text style={s.vitalValue}>{l.text}</Text>
              <Text style={s.vitalConfidence}>{l.confidence}</Text>
            </View>
          ))}
          <Text style={s.vitalNote}>{report.vitals.note}</Text>
        </View>,
      ]}
    />
  );
}

export function ReportDocument({ report }: { report: Report }) {
  const hasMedicines = report.medicines.length > 0;
  return (
    <Document title={report.title} author="MedCheck" subject="Medicine report" creator="MedCheck" producer="MedCheck">
      <Page size="LETTER" style={s.page}>
        <View style={s.header} fixed>
          <View style={s.brand}>
            <Text style={s.mark}>M</Text>
            <Text style={s.wordmark}>MedCheck</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.kicker}>Medicine report</Text>
            <Text style={[s.small, { marginTop: 3 }]}>{report.generatedAtLabel}</Text>
          </View>
        </View>
        <View style={s.headerRule} fixed />

        <Text style={s.title}>{report.title}</Text>
        {hasMedicines && (
          <Text style={s.meta}>
            {plural(report.medicines.length, "medicine", "medicines")} ·{" "}
            {report.warnings.length === 0 ? "no warnings" : plural(report.warnings.length, "warning", "warnings")}
          </Text>
        )}

        {report.isEmpty ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>No medicines yet</Text>
            <Text style={s.emptyText}>
              Medicines added in MedCheck will appear here, with what their labels say and any warnings.
            </Text>
          </View>
        ) : (
          <>
            <Section
              title="Medicines"
              items={
                hasMedicines
                  ? report.medicines.map((m) => <Medicine key={m.id} medicine={m} />)
                  : [<Text key="none" style={s.empty}>No confirmed medicines yet.</Text>]
              }
            />
            {hasMedicines && (
              <Section
                title="Warnings"
                items={
                  report.warnings.length === 0
                    ? [<Text key="none" style={s.empty}>{NO_WARNINGS}</Text>]
                    : report.warnings.map((w) => <WarningCard key={w.id} warning={w} />)
                }
              />
            )}
            <NotYetConfirmed report={report} />
          </>
        )}
        <Vitals report={report} />

        <Text style={s.boundary} wrap={false}>
          {report.boundary}
        </Text>

        <View style={s.footer} fixed>
          <Text>MedCheck · Evidence, not advice</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              [report.personName, `Page ${pageNumber} of ${totalPages}`].filter(Boolean).join(" · ")
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export function renderReportPdf(report: Report): Promise<Buffer> {
  return renderToBuffer(<ReportDocument report={report} />);
}
