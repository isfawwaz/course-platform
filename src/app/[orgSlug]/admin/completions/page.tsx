import { resolveOrgIdBySlug } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

import { ReviewActions } from "./review-actions";

/**
 * Completion review queue (staff). Lists completions awaiting review (all required lessons
 * watched → auto-moved to `pending_review`). Confirm issues a certificate (if the course
 * has it enabled); reject closes it with none. RLS scopes reads to this org's staff.
 */
type ReviewRow = {
  id: string;
  lessons_completed_at: string | null;
  courses: { title: string } | null;
  profiles: { full_name: string; email: string } | null;
};

export default async function CompletionsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  const orgId = await resolveOrgIdBySlug(supabase, orgSlug);

  let rows: ReviewRow[] = [];
  if (orgId) {
    const { data } = await supabase
      .from("course_completions")
      .select(
        "id, lessons_completed_at, courses(title), profiles!course_completions_user_id_fkey(full_name, email)",
      )
      .eq("org_id", orgId)
      .eq("status", "pending_review")
      .order("lessons_completed_at", { ascending: true });
    rows = (data as ReviewRow[] | null) ?? [];
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Completions to review
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Students who finished all required lessons. Confirm to issue a certificate, or
          reject to close it without one.
        </p>
      </div>

      {rows.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {rows.map((row) => {
            const name =
              row.profiles?.full_name?.trim() ||
              row.profiles?.email ||
              "Unknown student";
            const finished = row.lessons_completed_at
              ? new Intl.DateTimeFormat("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(new Date(row.lessons_completed_at))
              : "—";
            return (
              <li
                key={row.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.courses?.title ?? "Unknown course"} · finished {finished}
                  </p>
                </div>
                <ReviewActions completionId={row.id} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing awaiting review right now.
        </p>
      )}
    </div>
  );
}
