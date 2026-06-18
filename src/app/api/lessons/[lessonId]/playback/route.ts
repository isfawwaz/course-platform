import { signPlaybackToken } from "@/lib/playback/token";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

/**
 * Issue a playback token for a lesson's video. The lesson read is RLS-gated (staff or
 * active enrolment), so reaching it proves authorization; the video row itself is
 * staff-only under RLS, so we read its status via the service client after that check.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, video_id, org_id")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson?.video_id) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const admin = createServiceClient();
  const { data: video } = await admin
    .from("videos")
    .select("status")
    .eq("id", lesson.video_id)
    .maybeSingle();
  if (video?.status !== "ready") {
    return Response.json({ error: "video not ready" }, { status: 409 });
  }

  const token = await signPlaybackToken(lesson.video_id, lesson.org_id);
  return Response.json({
    videoId: lesson.video_id,
    token,
    src: `/api/playback/${lesson.video_id}/master.m3u8?t=${token}`,
  });
}
