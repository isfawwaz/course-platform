// "Your certificate is ready" notification (RFC-003 §9). The verification page — not the
// email or the PDF — is the source of truth, so the email's primary CTA is the verify URL.
import { escapeHtml, type EmailMessage } from "../client";

export interface CertificateReadyParams {
  to: string;
  studentName: string;
  courseTitle: string;
  orgName: string;
  verifyUrl: string;
  locale: "id" | "en";
}

interface Copy {
  subject: (courseTitle: string) => string;
  greeting: (name: string) => string;
  body: (courseTitle: string, orgName: string) => string;
  cta: string;
  note: string;
}

const COPY: Record<"id" | "en", Copy> = {
  id: {
    subject: (course) => `Sertifikat Anda untuk "${course}" sudah siap`,
    greeting: (name) => `Halo ${name},`,
    body: (course, org) =>
      `Selamat! Sertifikat Anda untuk "${course}" dari ${org} telah diterbitkan.`,
    cta: "Lihat & verifikasi sertifikat",
    note: "Tautan ini adalah sumber resmi untuk memverifikasi keaslian sertifikat Anda.",
  },
  en: {
    subject: (course) => `Your certificate for "${course}" is ready`,
    greeting: (name) => `Hi ${name},`,
    body: (course, org) =>
      `Congratulations! Your certificate for "${course}" from ${org} has been issued.`,
    cta: "View & verify certificate",
    note: "This link is the official source for verifying your certificate's authenticity.",
  },
};

/**
 * Build the localized "certificate ready" email (subject + HTML + plain text). User-derived
 * values are HTML-escaped in the markup; the verify URL is the primary CTA.
 */
export function certificateReadyEmail(p: CertificateReadyParams): EmailMessage {
  const t = COPY[p.locale];
  const subject = t.subject(p.courseTitle);

  // Plain-text values for the text part; escaped for the HTML part.
  const name = p.studentName;
  const course = p.courseTitle;
  const org = p.orgName;

  const text = [
    t.greeting(name),
    "",
    t.body(course, org),
    "",
    `${t.cta}: ${p.verifyUrl}`,
    "",
    t.note,
  ].join("\n");

  const html = `<!doctype html>
<html lang="${p.locale}">
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">
      <tr><td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(t.greeting(name))}</p>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.5;">${escapeHtml(t.body(course, org))}</p>
        <p style="margin:0 0 24px;">
          <a href="${encodeURI(p.verifyUrl)}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">${escapeHtml(t.cta)}</a>
        </p>
        <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">${escapeHtml(t.note)}</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { to: p.to, subject, html, text };
}
