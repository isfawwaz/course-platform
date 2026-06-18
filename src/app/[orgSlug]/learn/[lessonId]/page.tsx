import { createClient } from "@/lib/supabase/server";

import { LessonPlayer } from "./lesson-player";

/** Student lesson player. Access is enforced by the playback/progress routes (RLS). */
export default async function LessonPage({
  params,
}: {
  params: Promise<{ orgSlug: string; lessonId: string }>;
}) {
  const { lessonId } = await params;

  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("lessons")
    .select("title")
    .eq("id", lessonId)
    .maybeSingle();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="mb-4 text-xl font-semibold text-foreground">
        {lesson?.title ?? "Lesson"}
      </h1>
      <LessonPlayer lessonId={lessonId} />
    </div>
  );
}
