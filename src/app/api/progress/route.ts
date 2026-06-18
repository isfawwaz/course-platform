import { createClient } from "@/lib/supabase/server";

const COMPLETE_THRESHOLD = 95; // percent watched (RFC-001 D6)

/**
 * Record clamped playback progress (RFC-001 §9, D7). Writes the caller's own
 * lesson_progress (RLS); the DB trigger auto-moves the completion to pending_review
 * once all required lessons are done. Anti-cheat: watched time can't advance faster
 * than wall-clock since the last write, and never exceeds the video duration.
 */
export async function POST(req: Request) {
  const { lessonId, lastPositionSec, watchedDeltaSec } = await req.json();
  if (!lessonId) return Response.json({ error: "lessonId required" }, { status: 422 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  // Lesson read is RLS-gated (staff or enrolled).
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, org_id, course_id, duration_sec")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) return Response.json({ error: "not found" }, { status: 404 });

  const { data: enrolment } = await supabase
    .from("enrolments")
    .select("id")
    .eq("course_id", lesson.course_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!enrolment) {
    // Staff without an enrolment can watch, but there's no progress to track.
    return Response.json({ percent: 0, completed: false, tracked: false });
  }

  const { data: prev } = await supabase
    .from("lesson_progress")
    .select("id, watched_sec, completed_at, updated_at")
    .eq("lesson_id", lessonId)
    .eq("user_id", user.id)
    .maybeSingle();

  const duration = lesson.duration_sec ?? 0;
  const now = Date.now();
  const prevWatched = prev?.watched_sec ?? 0;
  const prevUpdated = prev ? new Date(prev.updated_at).getTime() : now;
  const wallclock = Math.max(0, (now - prevUpdated) / 1000) + 2; // +2s grace
  const delta = Math.max(0, Math.min(Number(watchedDeltaSec) || 0, wallclock));
  const watched = duration
    ? Math.min(prevWatched + delta, duration)
    : prevWatched + delta;
  const percent = duration
    ? Math.min(100, Math.round((watched / duration) * 100))
    : 0;
  const completed = percent >= COMPLETE_THRESHOLD;
  const pos = Math.max(
    0,
    Math.min(Number(lastPositionSec) || 0, duration || Number.MAX_SAFE_INTEGER),
  );

  const row = {
    org_id: lesson.org_id,
    enrolment_id: enrolment.id,
    lesson_id: lessonId,
    user_id: user.id,
    last_position_sec: Math.round(pos),
    watched_sec: Math.round(watched),
    percent,
    completed,
    completed_at: completed
      ? (prev?.completed_at ?? new Date().toISOString())
      : null,
  };

  if (prev) {
    await supabase.from("lesson_progress").update(row).eq("id", prev.id);
  } else {
    await supabase.from("lesson_progress").insert(row);
  }

  return Response.json({ percent, completed, tracked: true });
}
