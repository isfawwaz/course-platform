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
import { signup, type AuthState } from "@/lib/auth/actions";

const EMPTY: AuthState = {};

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, EMPTY);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Already invited? Use the link in your email instead.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              name="full_name"
              type="text"
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
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
          {state.notice ? (
            <p
              role="status"
              className="rounded-md bg-success-subtle px-3 py-2 text-sm text-success"
            >
              {state.notice}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
