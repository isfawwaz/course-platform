/**
 * Branded certificate template (RFC-003 §6 step 3). Rendered to PDF by the certificate
 * worker. Single template for the MVP; branding/layout is an open design question
 * (RFC-003 §13), so this is intentionally clean and conservative.
 *
 * Fonts: uses react-pdf's built-in Helvetica (WinAnsi/Latin-1), which covers Indonesian
 * (largely ASCII) and common Latin names. Embedding Inter/Noto for full diacritic coverage
 * is a follow-up tied to the branding pass — Font.register a TTF when the design lands.
 */
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

export type CertificateTemplateProps = {
  studentName: string;
  courseTitle: string;
  orgName: string;
  code: string;
  issuedAt: string; // ISO
  verifyUrl: string;
  qrDataUrl: string;
  locale: "id" | "en";
};

const COPY = {
  id: {
    title: "Sertifikat Penyelesaian",
    awardedTo: "Diberikan kepada",
    forCompleting: "atas penyelesaian kursus",
    issued: "Diterbitkan",
    verifyAt: "Verifikasi di",
    code: "Kode",
  },
  en: {
    title: "Certificate of Completion",
    awardedTo: "Awarded to",
    forCompleting: "for completing",
    issued: "Issued",
    verifyAt: "Verify at",
    code: "Code",
  },
} as const;

const styles = StyleSheet.create({
  page: {
    paddingVertical: 56,
    paddingHorizontal: 64,
    fontFamily: "Helvetica",
    color: "#0f172a", // slate-900
  },
  frame: {
    flexGrow: 1,
    borderWidth: 2,
    borderColor: "#0f172a",
    borderStyle: "solid",
    padding: 40,
    justifyContent: "space-between",
  },
  org: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#475569", // slate-600
  },
  title: { fontFamily: "Helvetica-Bold", fontSize: 34, marginTop: 24 },
  label: { fontSize: 11, color: "#64748b", marginTop: 28 }, // slate-500
  studentName: { fontFamily: "Helvetica-Bold", fontSize: 28, marginTop: 6 },
  courseTitle: { fontSize: 18, marginTop: 6 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  meta: { fontSize: 10, color: "#475569", lineHeight: 1.5 },
  codeValue: { fontFamily: "Courier-Bold", fontSize: 12, color: "#0f172a" },
  qr: { width: 96, height: 96 },
});

export function CertificateDocument(props: CertificateTemplateProps) {
  const t = COPY[props.locale] ?? COPY.en;
  const issued = new Intl.DateTimeFormat(
    props.locale === "id" ? "id-ID" : "en-GB",
    { day: "numeric", month: "long", year: "numeric" },
  ).format(new Date(props.issuedAt));

  return (
    <Document
      title={`${t.title} — ${props.studentName}`}
      author={props.orgName}
      subject={props.courseTitle}
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <View>
            <Text style={styles.org}>{props.orgName}</Text>
            <Text style={styles.title}>{t.title}</Text>
            <Text style={styles.label}>{t.awardedTo}</Text>
            <Text style={styles.studentName}>{props.studentName}</Text>
            <Text style={styles.label}>{t.forCompleting}</Text>
            <Text style={styles.courseTitle}>{props.courseTitle}</Text>
          </View>

          <View style={styles.footerRow}>
            <View style={styles.meta}>
              <Text>
                {t.issued}: {issued}
              </Text>
              <Text>
                {t.code}: <Text style={styles.codeValue}>{props.code}</Text>
              </Text>
              <Text>
                {t.verifyAt}: {props.verifyUrl}
              </Text>
            </View>
            {/* @react-pdf Image is a PDF primitive, not a DOM <img> — no alt prop. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image style={styles.qr} src={props.qrDataUrl} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
