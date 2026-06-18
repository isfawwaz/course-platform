"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createModule, type ContentState } from "@/lib/content/actions";

const EMPTY: ContentState = {};

export function ModuleCreateForm({
  orgSlug,
  courseId,
}: {
  orgSlug: string;
  courseId: string;
}) {
  const [state, action, pending] = useActionState(createModule, EMPTY);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="org_slug" value={orgSlug} />
      <input type="hidden" name="course_id" value={courseId} />
      <div className="flex gap-2">
        <Input name="title" placeholder="New module title" required />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Adding…" : "Add module"}
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
