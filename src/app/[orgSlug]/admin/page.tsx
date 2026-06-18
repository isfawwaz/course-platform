import { resolveOrgIdBySlug } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

import { InviteForm } from "./invite-form";
import { VideoList, type VideoRow } from "./video-list";
import { VideoUploader } from "./video-uploader";

/**
 * Admin console (staff-gated, inside the Refine provider). Upload videos and watch them
 * transcode, plus invite members. Real course builder/roster arrive in later epics.
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
  if (orgId) {
    const { data } = await supabase
      .from("videos")
      .select("id, title, status, duration_sec")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    videos = data ?? [];
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Admin console</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a video to run it through the pipeline, or invite people.
        </p>
      </div>

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
