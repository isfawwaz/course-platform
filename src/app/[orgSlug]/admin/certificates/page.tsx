import Link from "next/link";

import { resolveOrgIdBySlug } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

import { RevokeButton } from "./revoke-button";

/**
 * Issued-certificates list (staff). `cert_select` lets staff read all of the org's
 * certificates. Staff can revoke a valid certificate (RFC-003 §8); revoked ones stay
 * listed, marked. The public verify link works for anyone.
 */
type CertRow = {
  id: string;
  code: string;
  student_name_snapshot: string;
  course_title_snapshot: string;
  issued_at: string;
  revoked: boolean;
};

export default async function AdminCertificatesPage({
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
      .select(
        "id, code, student_name_snapshot, course_title_snapshot, issued_at, revoked",
      )
      .eq("org_id", orgId)
      .order("issued_at", { ascending: false });
    rows = data ?? [];
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Certificates</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Every certificate issued by this studio. Revoking one immediately marks it invalid
          on its public verification page.
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
                    {cert.student_name_snapshot}
                    {cert.revoked ? (
                      <span className="ml-2 rounded bg-danger-subtle px-1.5 py-0.5 text-xs text-danger">
                        Revoked
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {cert.course_title_snapshot} ·{" "}
                    <Link
                      href={`/verify/${cert.code}`}
                      className="font-mono hover:underline"
                    >
                      {cert.code}
                    </Link>{" "}
                    · issued {issued}
                  </p>
                </div>
                {!cert.revoked ? (
                  <RevokeButton certificateId={cert.id} />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No certificates issued yet.
        </p>
      )}
    </div>
  );
}
