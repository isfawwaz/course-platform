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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  login,
  sendMagicLink,
  type AuthState,
} from "@/lib/auth/actions";

const EMPTY: AuthState = {};

function Notice({ state }: { state: AuthState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger"
      >
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p
        role="status"
        className="rounded-md bg-success-subtle px-3 py-2 text-sm text-success"
      >
        {state.notice}
      </p>
    );
  }
  return null;
}

export function LoginForm({ initialError }: { initialError?: string }) {
  const [pwState, pwAction, pwPending] = useActionState(login, EMPTY);
  const [mlState, mlAction, mlPending] = useActionState(sendMagicLink, EMPTY);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Access your courses and certificates.</CardDescription>
      </CardHeader>
      <CardContent>
        {initialError ? (
          <p
            role="alert"
            className="mb-4 rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger"
          >
            {initialError}
          </p>
        ) : null}

        <Tabs defaultValue="password">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="magic">Email link</TabsTrigger>
          </TabsList>

          <TabsContent value="password">
            <form action={pwAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pw-email">Email</Label>
                <Input
                  id="pw-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw-password">Password</Label>
                <Input
                  id="pw-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Notice state={pwState} />
              <Button type="submit" className="w-full" disabled={pwPending}>
                {pwPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="magic">
            <form action={mlAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ml-email">Email</Label>
                <Input
                  id="ml-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <Notice state={mlState} />
              <Button type="submit" className="w-full" disabled={mlPending}>
                {mlPending ? "Sending…" : "Send sign-in link"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link
            href="/signup"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
