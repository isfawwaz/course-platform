"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPassword, type AuthState } from "@/lib/auth/actions";

const EMPTY: AuthState = {};

export function AcceptInviteClient({
  activated,
  destination,
}: {
  activated: number;
  destination: string;
}) {
  const [state, action, pending] = useActionState(setPassword, EMPTY);
  const hasOrg = destination !== "/no-access" && destination !== "/login";

  // Authenticated but nothing to accept and no active org.
  if (activated === 0 && !hasOrg) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No pending invitation</CardTitle>
          <CardDescription>
            This account has no invitation waiting. Ask your studio to invite this
            email, or sign in with a different account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {activated > 0 ? "Invitation accepted" : "You're all set"}
        </CardTitle>
        <CardDescription>
          Set a password so you can sign in directly next time, or skip and
          continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>

          {state.error ? (
            <p
              role="alert"
              className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger"
            >
              {state.error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Set password & continue"}
          </Button>
        </form>

        <Button asChild variant="ghost" className="mt-3 w-full">
          <Link href={hasOrg ? destination : "/login"}>Skip for now</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
