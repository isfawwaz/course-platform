import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/** Resolve an org id from its slug under the caller's session (RLS: members only). */
export async function resolveOrgIdBySlug(
  supabase: SupabaseClient<Database>,
  slug: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("orgs")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Returns the caller's id if they are active staff (owner/admin) of the org, else null.
 * Used by Route Handlers to gate writes that RLS alone can't scope (e.g. S3 operations).
 */
export async function requireStaffOrg(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<{ userId: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return null;
  }
  return { userId: user.id };
}
