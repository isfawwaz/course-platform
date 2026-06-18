"use client";

import { Refine, type AuthProvider } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router/app";
import { dataProvider } from "@refinedev/supabase";
import { useMemo } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Refine provider tree for the admin console. Wraps only `/[orgSlug]/admin/*`.
 * Data goes through the RLS-bound browser client, so tenant isolation holds.
 * Resources are added per epic (course builder = 0.D). Auth is primarily enforced
 * server-side (admin layout); this authProvider keeps Refine's hooks consistent.
 */
export function RefineProvider({
  children,
  role,
}: {
  children: React.ReactNode;
  role: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const data = useMemo(() => dataProvider(supabase), [supabase]);

  const authProvider: AuthProvider = useMemo(
    () => ({
      login: async () => ({ success: false }),
      logout: async () => {
        await supabase.auth.signOut();
        return { success: true, redirectTo: "/login" };
      },
      check: async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        return user
          ? { authenticated: true }
          : { authenticated: false, redirectTo: "/login" };
      },
      onError: async (error) => ({ error }),
      getPermissions: async () => role,
      getIdentity: async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        return user ? { id: user.id, name: user.email } : null;
      },
    }),
    [supabase, role],
  );

  const isStaff = role === "owner" || role === "admin";

  return (
    <Refine
      routerProvider={routerProvider}
      dataProvider={data}
      authProvider={authProvider}
      accessControlProvider={{ can: async () => ({ can: isStaff }) }}
      options={{
        syncWithLocation: true,
        warnWhenUnsavedChanges: true,
        disableTelemetry: true,
      }}
      resources={[]}
    >
      {children}
    </Refine>
  );
}
