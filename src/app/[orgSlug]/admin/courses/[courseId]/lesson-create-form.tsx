"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLesson, type ContentState } from "@/lib/content/actions";

const EMPTY: ContentState = {};

export function LessonCreateForm({
  orgSlug,
  courseId,
  moduleId,
  videos,
}: {
  orgSlug: string;
  courseId: string;
  moduleId: string;
  videos: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(createLesson, EMPTY);

  return (
    <form action={action} className="space-y-3 rounded-md border border-border bg-surface p-3">
      <input type="hidden" name="org_slug" value={orgSlug} />
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="module_id" value={moduleId} />
      <Input name="title" placeholder="Lesson title" required />
      <div className="space-y-1">
        <Label htmlFor={`video-${moduleId}`}>Video (ready only)</Label>
        <select
          id={`video-${moduleId}`}
          name="video_id"
          defaultValue=""
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">No video yet</option>
          {videos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" name="required" defaultChecked className="size-4" />
        Required for completion
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add lesson"}
      </Button>
    </form>
  );
}
