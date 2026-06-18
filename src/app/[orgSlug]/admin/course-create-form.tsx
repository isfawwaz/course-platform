"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCourse, type ContentState } from "@/lib/content/actions";

const EMPTY: ContentState = {};

export function CourseCreateForm({ orgSlug }: { orgSlug: string }) {
  const [state, action, pending] = useActionState(createCourse, EMPTY);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="org_slug" value={orgSlug} />
      <div className="flex gap-2">
        <Input name="title" placeholder="New course title" required />
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add course"}
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
