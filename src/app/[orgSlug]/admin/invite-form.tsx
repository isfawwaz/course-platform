"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendInvite, type InviteState } from "@/lib/auth/invites";

const EMPTY: InviteState = {};

export function InviteForm({ orgSlug }: { orgSlug: string }) {
  const [state, action, pending] = useActionState(sendInvite, EMPTY);

  return (
    <form action={action} className="max-w-md space-y-4">
      <input type="hidden" name="org_slug" value={orgSlug} />
      <div className="space-y-2">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          placeholder="student@example.com"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-role">Role</Label>
        <select
          id="invite-role"
          name="role"
          defaultValue="student"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="student">Student</option>
          <option value="admin">Admin</option>
          <option value="owner">Owner</option>
        </select>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p
          role="status"
          className="rounded-md bg-success-subtle px-3 py-2 text-sm text-success"
        >
          {state.notice}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send invite"}
      </Button>
    </form>
  );
}
