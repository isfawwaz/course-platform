import Link from "next/link";

import { resolveOrgIdBySlug } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

import { CourseCreateForm } from "./course-create-form";
import { InviteForm } from "./invite-form";
import { VideoList, type VideoRow } from "./video-list";
import { VideoUploader } from "./video-uploader";

/**
 * Admin console (staff-gated, inside the Refine provider). Build courses, upload videos,
 * invite members. Content writes go through server actions (org_id set server-side).
 */
export default async function AdminHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  const orgId = await resolveOrgIdBySlug(supabase, orgSlug);

  let videos: VideoRow[] = [];
  let courses: { id: string; title: string; status: string }[] = [];
  if (orgId) {
    const [{ data: v }, { data: c }] = await Promise.all([
      supabase
        .from("videos")
        .select("id, title, status, duration_sec")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false }),
      supabase
        .from("courses")
        .select("id, title, status")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false }),
    ]);
    videos = v ?? [];
    courses = c ?? [];
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Admin console</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Build courses, upload videos, and invite people.
        </p>
        <div className="mt-3 flex gap-4 text-sm font-medium text-primary">
          <Link href={`/${orgSlug}/admin/completions`} className="hover:underline">
            Review completions →
          </Link>
          <Link href={`/${orgSlug}/admin/certificates`} className="hover:underline">
            Certificates →
          </Link>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Courses</h2>
        {courses.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {courses.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/${orgSlug}/admin/courses/${c.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted"
                >
                  <span className="text-sm text-foreground">{c.title}</span>
                  <span className="text-xs capitalize text-muted-foreground">
                    {c.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No courses yet.</p>
        )}
        <CourseCreateForm orgSlug={orgSlug} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Videos</h2>
        <VideoUploader orgSlug={orgSlug} />
        {orgId ? <VideoList orgId={orgId} initial={videos} /> : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Invite a member</h2>
        <InviteForm orgSlug={orgSlug} />
      </section>
    </div>
  );
}
