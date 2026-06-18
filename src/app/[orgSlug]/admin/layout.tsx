import { redirect } from "next/navigation";

import { resolveLanding } from "@/lib/auth/landing";
import { createClient } from "@/lib/supabase/server";

import { RefineProvider } from "./refine-provider";

/**
 * Admin console gate. Sits under `[orgSlug]/layout` (which already requires active
 * membership); this adds the STAFF-only check (owner/admin) before mounting Refine.
 * Students are bounced to their org dashboard.
 */
export default async function AdminLayout({
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
  if (!user) redirect(`/login?redirect=/${orgSlug}/admin`);

  const { data: org } = await supabase
    .from("orgs")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) redirect(await resolveLanding(supabase));

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const role = membership?.role;
  if (role !== "owner" && role !== "admin") {
    redirect(`/${orgSlug}`);
  }

  return <RefineProvider role={role}>{children}</RefineProvider>;
}
