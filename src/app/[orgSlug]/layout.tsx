import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { resolveLanding } from "@/lib/auth/landing";
import { logout } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { deriveAccentVars } from "@/lib/theme/accent";

/**
 * Org-scoped shell — the real authorization layer (RFC-002 §5). Resolving the org by
 * slug under the caller's session only returns a row when they're an ACTIVE member
 * (`orgs_member_read` = `is_member`), so a non-member or bad slug yields nothing and
 * we bounce the user to their own landing. Applies the per-org accent here.
 */
export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/${orgSlug}`);

  const { data: org } = await supabase
    .from("orgs")
    .select("id, name, slug, theme_accent")
    .eq("slug", orgSlug)
    .maybeSingle();

  // Not an active member of this org (RLS hid it) or it doesn't exist.
  if (!org) redirect(await resolveLanding(supabase));

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  const role = membership?.role ?? "student";

  const accentVars = deriveAccentVars(org.theme_accent);

  return (
    <div
      style={accentVars as React.CSSProperties}
      className="flex min-h-full flex-1 flex-col bg-surface"
    >
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="size-2.5 rounded-full bg-primary" aria-hidden />
            <span className="font-semibold text-foreground">{org.name}</span>
            <span className="text-xs capitalize text-muted-foreground">
              {role}
            </span>
          </div>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
