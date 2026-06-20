import { normalizeCertificateCode } from "@/lib/certificates/code";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * Public certificate verification (RFC-003 §7). The verification page — not the PDF — is the
 * source of truth: a code resolving against our DB is the proof. Calls the
 * `public.verify_certificate` RPC (snapshots only, no live joins, no other-tenant data).
 * Reachable without a session (`/verify` is a public path in the proxy gate).
 */
type VerifyResult =
  Database["public"]["Functions"]["verify_certificate"]["Returns"][number];

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = normalizeCertificateCode(decodeURIComponent(raw));

  let result: VerifyResult | null = null;
  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("verify_certificate", { p_code: code });
    result = data && data.length > 0 ? data[0] : null;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-16">
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        {!result ? (
          <Status
            tone="danger"
            heading="Certificate not found"
            body={
              code
                ? `No certificate matches the code ${code}.`
                : "That doesn't look like a valid certificate code."
            }
          />
        ) : result.revoked ? (
          <Status
            tone="danger"
            heading="Certificate revoked"
            body="This certificate has been revoked by the issuing studio and is no longer valid."
            detail={result}
          />
        ) : (
          <Status
            tone="success"
            heading="Certificate verified"
            body="This is a genuine certificate issued through the platform."
            detail={result}
          />
        )}
      </div>
    </main>
  );
}

function Status({
  tone,
  heading,
  body,
  detail,
}: {
  tone: "success" | "danger";
  heading: string;
  body: string;
  detail?: VerifyResult;
}) {
  const issued = detail
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(detail.issued_at))
    : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
            tone === "success"
              ? "bg-success-subtle text-success"
              : "bg-danger-subtle text-danger"
          }`}
        >
          {tone === "success" ? "Verified" : "Invalid"}
        </span>
        <h1 className="text-2xl font-semibold text-foreground">{heading}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>

      {detail ? (
        <dl className="grid grid-cols-3 gap-y-3 border-t border-border pt-6 text-sm">
          <Field label="Awarded to" value={detail.student_name} />
          <Field label="Course" value={detail.course_title} />
          <Field label="Studio" value={detail.org_name} />
          {issued ? <Field label="Issued" value={issued} /> : null}
        </dl>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="col-span-1 text-muted-foreground">{label}</dt>
      <dd className="col-span-2 font-medium text-foreground">{value}</dd>
    </>
  );
}
