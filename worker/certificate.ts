/**
 * Certificate issuance worker (RFC-003 §6). Pulls `certificate` jobs from pg-boss, renders
 * the branded PDF (react-pdf) with an embedded QR, uploads it to the private Supabase
 * Storage `certificates` bucket, and stamps `pdf_key` on the row.
 *
 * Idempotent (Decision DK): keyed by certificateId, re-running overwrites the same object
 * and never changes the code/identity. Uses a service-role Supabase client because the
 * worker has no user session — it must NOT import the app's `server-only`-guarded client.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

import type { Database } from "../src/lib/supabase/database.types";
import {
  CERTIFICATES_BUCKET,
  certificatePdfKey,
} from "../src/lib/certificates/keys";
import { sendEmail } from "../src/lib/email/client";
import { certificateReadyEmail } from "../src/lib/email/templates/certificate-ready";
import type { CertificateJob } from "../src/lib/queue/boss";

import { CertificateDocument } from "./certificate-template";

/**
 * Public origin printed on the cert + encoded in its QR. A wrong value bakes a broken verify
 * link into an immutable PDF, so in production we refuse to fall back to localhost.
 */
function publicUrl(): string {
  const url = process.env.APP_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "APP_PUBLIC_URL (or NEXT_PUBLIC_APP_URL) must be set in production — " +
        "certificate verify URLs would otherwise be wrong.",
    );
  }
  return "http://localhost:3000";
}

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

function admin() {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required for the certificate worker.",
    );
  }
  adminClient = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

export async function processCertificate(job: CertificateJob): Promise<void> {
  const { certificateId } = job;
  const supabase = admin();
  console.log(`[certificate] ${certificateId} start`);

  const { data: cert, error } = await supabase
    .from("certificates")
    .select(
      "id, org_id, user_id, code, student_name_snapshot, course_title_snapshot, org_name_snapshot, issued_at",
    )
    .eq("id", certificateId)
    .maybeSingle();
  if (error) throw new Error(`load certificate: ${error.message}`);
  if (!cert) {
    // Row gone (e.g. completion deleted) — nothing to render. Drop the job.
    console.warn(`[certificate] ${certificateId} not found — skipping`);
    return;
  }

  // Org locale drives the certificate language; default to Indonesian (platform default).
  // A read failure must not silently emit a wrong-language certificate.
  const { data: org, error: orgError } = await supabase
    .from("orgs")
    .select("locale")
    .eq("id", cert.org_id)
    .maybeSingle();
  if (orgError) throw new Error(`load org locale: ${orgError.message}`);
  const locale = org?.locale === "en" ? "en" : "id";

  const verifyUrl = `${publicUrl()}/verify/${cert.code}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 256 });

  const pdf = await renderToBuffer(
    CertificateDocument({
      studentName: cert.student_name_snapshot,
      courseTitle: cert.course_title_snapshot,
      orgName: cert.org_name_snapshot,
      code: cert.code,
      issuedAt: cert.issued_at,
      verifyUrl,
      qrDataUrl,
      locale,
    }),
  );

  const key = certificatePdfKey(cert.org_id, cert.id);
  const { error: uploadError } = await supabase.storage
    .from(CERTIFICATES_BUCKET)
    .upload(key, pdf, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw new Error(`upload pdf: ${uploadError.message}`);

  const { error: updateError } = await supabase
    .from("certificates")
    .update({ pdf_key: key })
    .eq("id", cert.id);
  if (updateError) throw new Error(`set pdf_key: ${updateError.message}`);

  // Notify the student their certificate is ready (RFC-003 §9). Best-effort: issuance has
  // already succeeded above, so a missing email or provider failure must never fail the job.
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", cert.user_id)
      .maybeSingle();
    if (profile?.email) {
      const sent = await sendEmail(
        certificateReadyEmail({
          to: profile.email,
          studentName: cert.student_name_snapshot,
          courseTitle: cert.course_title_snapshot,
          orgName: cert.org_name_snapshot,
          verifyUrl,
          locale,
        }),
      );
      console.log(
        `[certificate] ${certificateId} ready → ${key} (${pdf.length} bytes); ` +
          `email ${sent ? "sent" : "skipped"} → ${profile.email}`,
      );
    } else {
      console.warn(
        `[certificate] ${certificateId} ready → ${key} (${pdf.length} bytes); ` +
          `no student email on file — notification skipped`,
      );
    }
  } catch (e) {
    console.error(
      `[certificate] ${certificateId} ready → ${key}; certificate-ready email failed:`,
      e instanceof Error ? e.message : e,
    );
  }
}
