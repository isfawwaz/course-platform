import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { LessonCreateForm } from "./lesson-create-form";
import { ModuleCreateForm } from "./module-create-form";

/** Minimal course builder: add modules and lessons, attach ready videos (0.D). */
export default async function CourseBuilderPage({
  params,
}: {
  params: Promise<{ orgSlug: string; courseId: string }>;
}) {
  const { orgSlug, courseId } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, status, org_id")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) notFound();

  const [{ data: modules }, { data: lessons }, { data: allVideos }] =
    await Promise.all([
      supabase
        .from("modules")
        .select("id, title, position")
        .eq("course_id", courseId)
        .order("position"),
      supabase
        .from("lessons")
        .select("id, title, module_id, position, required, video_id")
        .eq("course_id", courseId)
        .order("position"),
      supabase
        .from("videos")
        .select("id, title, status")
        .eq("org_id", course.org_id)
        .order("created_at", { ascending: false }),
    ]);

  const videoById = new Map((allVideos ?? []).map((v) => [v.id, v]));
  const readyVideos = (allVideos ?? []).filter((v) => v.status === "ready");
  const lessonsByModule = new Map<string, typeof lessons>();
  for (const l of lessons ?? []) {
    const arr = lessonsByModule.get(l.module_id) ?? [];
    arr.push(l);
    lessonsByModule.set(l.module_id, arr);
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-10">
      <div>
        <Link
          href={`/${orgSlug}/admin`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Admin
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          {course.title}
        </h1>
        <span className="text-xs capitalize text-muted-foreground">
          {course.status}
        </span>
      </div>

      <div className="space-y-6">
        {(modules ?? []).map((m) => (
          <section
            key={m.id}
            className="space-y-3 rounded-lg border border-border bg-card p-4"
          >
            <h2 className="font-semibold text-foreground">{m.title}</h2>
            <ul className="space-y-1">
              {(lessonsByModule.get(m.id) ?? []).map((l) => {
                const v = l.video_id ? videoById.get(l.video_id) : null;
                return (
                  <li
                    key={l.id}
                    className="flex items-center justify-between rounded-md bg-surface px-3 py-2 text-sm"
                  >
                    <span className="text-foreground">
                      {l.title}
                      {l.required ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          required
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {v ? `${v.title} · ${v.status}` : "no video"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <LessonCreateForm
              orgSlug={orgSlug}
              courseId={courseId}
              moduleId={m.id}
              videos={readyVideos}
            />
          </section>
        ))}

        <ModuleCreateForm orgSlug={orgSlug} courseId={courseId} />
      </div>
    </div>
  );
}
