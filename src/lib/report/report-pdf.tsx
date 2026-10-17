// The pharmacist report as a PDF (react-pdf). Built-in Helvetica only — no remote fonts, so it
// renders the same on Vercel and locally. Stick to WinAnsi characters (no ≥, ✓, emoji).
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { CheckStatus } from "@/lib/domain/schema";
import type { Report, ReportFinding, ReportMedicine } from "./build-report";

const c = {
  teal: "#2b7a78",
  tealDark: "#1f5c5a",
  tealSurface: "#eef6f5",
  ink: "#1d2b33",
  muted: "#5b6b75",
  rule: "#dde5e8",
  amber: "#d08a1c",
  amberInk: "#7a4d0b",
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
  patient: { fontFamily: "Helvetica-Bold", fontSize: 22, letterSpacing: -0.4 },
  meta: { fontSize: 10.5, color: c.muted, marginTop: 2 },
  demo: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: c.neutralSurface,
    fontSize: 8.5,
    color: c.muted,
  },
  intro: { marginTop: 10, color: c.muted, fontSize: 10.5, lineHeight: 1.4 },
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
  questions: { backgroundColor: c.tealSurface, borderRadius: 8, padding: 14 },
  question: { flexDirection: "row", marginBottom: 8 },
  qNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: c.teal,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    textAlign: "center",
    paddingTop: 3.5,
    marginRight: 9,
    marginTop: 0.5,
  },
  qText: { fontSize: 11, fontFamily: "Helvetica-Bold", lineHeight: 1.35 },
  qContext: { fontSize: 9, color: c.muted, marginTop: 1, fontFamily: "Helvetica" },
  empty: { color: c.muted, fontFamily: "Helvetica-Oblique" },
  card: {
    borderLeftWidth: 3,
    borderLeftColor: c.amber,
    backgroundColor: c.amberSurface,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  cardKicker: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: c.amberInk, letterSpacing: 0.8, textTransform: "uppercase" },
  cardTitle: { fontFamily: "Helvetica-Bold", fontSize: 12, marginTop: 2 },
  cardDetail: { marginTop: 3, lineHeight: 1.4 },
  table: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#ecdcbc" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ecdcbc", paddingVertical: 4 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: c.amberInk, textTransform: "uppercase", letterSpacing: 0.5 },
  td: { fontSize: 10 },
  colProduct: { width: "34%", paddingRight: 6 },
  colSource: { width: "33%", paddingRight: 6 },
  colValue: { width: "33%" },
  quote: { marginTop: 8, paddingLeft: 8, borderLeftWidth: 1.5, borderLeftColor: "#e3c58f" },
  quoteLabel: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: c.amberInk },
  quoteText: { fontFamily: "Helvetica-Oblique", fontSize: 10, marginTop: 1, lineHeight: 1.4 },
  ask: { marginTop: 8, fontSize: 10.5, color: c.ink, lineHeight: 1.4 },
  askLabel: { fontFamily: "Helvetica-Bold" },
  summary: { marginBottom: 8, color: c.muted },
  checkRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.rule },
  checkName: { width: "30%", fontFamily: "Helvetica-Bold", fontSize: 10.5, paddingRight: 6 },
  checkStatusCol: { width: "28%", paddingRight: 6 },
  checkBody: { width: "42%" },
  chip: { alignSelf: "flex-start", borderRadius: 4, paddingVertical: 1.5, paddingHorizontal: 5, fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  reason: { fontSize: 9.5, color: c.violet, marginTop: 2 },
  med: { borderWidth: 1, borderColor: c.rule, borderRadius: 6, padding: 10, marginBottom: 8 },
  medName: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  medSource: { fontSize: 9, color: c.muted, marginTop: 1 },
  dl: { flexDirection: "row", marginTop: 4 },
  dt: { width: 92, fontSize: 9, color: c.muted, paddingTop: 1 },
  dd: { flex: 1, fontSize: 10.5, lineHeight: 1.35 },
  boundary: { marginTop: 22, borderRadius: 6, borderWidth: 1, borderColor: c.rule, padding: 12, backgroundColor: c.neutralSurface },
  boundaryTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  boundaryText: { fontSize: 10, color: c.muted, marginTop: 3, lineHeight: 1.4 },
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

const chipColors: Record<CheckStatus, { backgroundColor: string; color: string }> = {
  finding: { backgroundColor: c.amberSurface, color: c.amberInk },
  unresolved: { backgroundColor: c.violetSurface, color: c.violet },
  no_finding: { backgroundColor: c.neutralSurface, color: c.muted },
  not_applicable: { backgroundColor: c.neutralSurface, color: c.muted },
};

function FindingCard({ finding }: { finding: ReportFinding }) {
  return (
    <View style={s.card} wrap={false}>
      <Text style={s.cardKicker}>{finding.checkName}</Text>
      <Text style={s.cardTitle}>{finding.title}</Text>
      <Text style={s.cardDetail}>{finding.detail}</Text>
      {finding.evidence.length > 0 && (
        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, s.colProduct]}>Product</Text>
            <Text style={[s.th, s.colSource]}>Document</Text>
            <Text style={[s.th, s.colValue]}>As printed</Text>
          </View>
          {finding.evidence.map((e, i) => (
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
      {finding.labelWarningQuote && (
        <View style={s.quote}>
          <Text style={s.quoteLabel}>The label says</Text>
          <Text style={s.quoteText}>&ldquo;{finding.labelWarningQuote}&rdquo;</Text>
        </View>
      )}
      <Text style={s.ask}>
        <Text style={s.askLabel}>Ask: </Text>
        {finding.pharmacistQuestion}
      </Text>
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
function Section({ title, lead, items }: { title: string; lead?: ReactNode; items: ReactNode[] }) {
  return (
    <View style={s.section}>
      <View wrap={false}>
        <Text style={s.h2}>{title}</Text>
        {lead}
        {items[0]}
      </View>
      {items.slice(1)}
    </View>
  );
}

export function ReportDocument({ report }: { report: Report }) {
  return (
    <Document title={report.title} author="MedCheck" subject="Pharmacist report" creator="MedCheck" producer="MedCheck">
      <Page size="LETTER" style={s.page}>
        <View style={s.header} fixed>
          <View style={s.brand}>
            <Text style={s.mark}>M</Text>
            <Text style={s.wordmark}>MedCheck</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.kicker}>Pharmacist report</Text>
            <Text style={[s.small, { marginTop: 3 }]}>Generated {report.generatedAtLabel}</Text>
          </View>
        </View>
        <View style={s.headerRule} fixed />

        <Text style={s.patient}>{report.heading}</Text>
        {report.subheading && <Text style={s.meta}>{report.subheading}</Text>}
        {report.isDemo && <Text style={s.demo}>Demo data — synthetic</Text>}
        <Text style={s.intro}>
          What the labels and documents on file say, the checks MedCheck ran on the confirmed values, and the questions to bring
          to a pharmacist or doctor.
        </Text>

        <View style={s.section}>
          <Text style={s.h2} minPresenceAhead={140}>Questions to ask</Text>
          <View style={s.questions}>
            {report.questions.length === 0 ? (
              <Text style={s.empty}>No questions came up from the checks run on confirmed fields.</Text>
            ) : (
              report.questions.map((q, i) => (
                <View key={i} style={s.question} wrap={false}>
                  <Text style={s.qNum}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.qText}>{q.text}</Text>
                    <Text style={s.qContext}>{q.context}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        <Section
          title="What the checks found"
          items={
            report.findings.length === 0
              ? [<Text key="none" style={s.empty}>No findings in confirmed fields.</Text>]
              : report.findings.map((f) => <FindingCard key={f.id} finding={f} />)
          }
        />

        <Section
          title="Checks run"
          lead={<Text style={s.summary}>{report.checksSummary}</Text>}
          items={report.checks.map((check) => (
            <View key={check.check} style={s.checkRow} wrap={false}>
              <Text style={s.checkName}>{check.name}</Text>
              <View style={s.checkStatusCol}>
                <Text style={[s.chip, chipColors[check.status]]}>{check.statusLabel}</Text>
              </View>
              <View style={s.checkBody}>
                <Text style={{ fontSize: 10 }}>{check.summary}</Text>
                {check.reasons.map((r, i) => (
                  <Text key={i} style={[s.reason, check.status === "unresolved" ? {} : { color: c.muted }]}>
                    - {r}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        />

        <Section
          title="Medicines on file"
          items={[
            ...(report.medicines.length === 0
              ? [<Text key="none" style={s.empty}>No confirmed medicines on file.</Text>]
              : report.medicines.map((m) => <Medicine key={m.id} medicine={m} />)),
            ...(report.unreviewedNote
              ? [
                  <Text key="drafts" style={[s.small, { marginTop: 2 }]}>
                    {report.unreviewedNote}
                  </Text>,
                ]
              : []),
          ]}
        />

        <View style={s.boundary} wrap={false}>
          <Text style={s.boundaryTitle}>Evidence, not advice</Text>
          <Text style={s.boundaryText}>{report.boundary}</Text>
          <Text style={s.boundaryText}>
            Already gave or took a double dose? Call Poison Control at 1-800-222-1222 or talk to a pharmacist.
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text>Generated by MedCheck · Evidence, not advice</Text>
          <Text render={({ pageNumber, totalPages }) => `${report.patientName} · Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export function renderReportPdf(report: Report): Promise<Buffer> {
  return renderToBuffer(<ReportDocument report={report} />);
}
