import Link from "next/link";

import { resolveOrgIdBySlug } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

/**
 * "My certificates" (student). Lists the caller's certificates for this org — `cert_select`
 * scopes the read to the owner. Download links hit the signed-download route; revoked
 * certificates stay visible (history) but clearly marked. The verify link is public.
 */
type CertRow = {
  id: string;
  code: string;
  course_title_snapshot: string;
  issued_at: string;
  pdf_key: string | null;
  revoked: boolean;
};

export default async function MyCertificatesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  const orgId = await resolveOrgIdBySlug(supabase, orgSlug);

  let rows: CertRow[] = [];
  if (orgId) {
    const { data } = await supabase
      .from("certificates")
      .select("id, code, course_title_snapshot, issued_at, pdf_key, revoked")
      .eq("org_id", orgId)
      .order("issued_at", { ascending: false });
    rows = data ?? [];
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">My certificates</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Certificates you&apos;ve earned. Anyone can verify one with its code.
        </p>
      </div>

      {rows.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {rows.map((cert) => {
            const issued = new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date(cert.issued_at));
            return (
              <li
                key={cert.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {cert.course_title_snapshot}
                    {cert.revoked ? (
                      <span className="ml-2 rounded bg-danger-subtle px-1.5 py-0.5 text-xs text-danger">
                        Revoked
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {cert.code} · issued {issued}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3 text-sm">
                  <Link
                    href={`/verify/${cert.code}`}
                    className="font-medium text-muted-foreground hover:underline"
                  >
                    Verify
                  </Link>
                  {cert.pdf_key ? (
                    <a
                      href={`/api/certificates/${cert.id}/download`}
                      className="font-medium text-primary hover:underline"
                    >
                      Download
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Preparing…</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have any certificates yet.
        </p>
      )}
    </div>
  );
}
