import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/**
 * Where an authenticated user should land, resolved from their `active` memberships:
 *   none  → /no-access   ·   one → /{orgSlug}   ·   several → /select-org
 *
 * Uses the RLS-bound client: a user can read their own membership rows
 * (`memberships_self_read`) and the orgs they're an active member of (`orgs_member_read`).
 * Two small queries avoid PostgREST embed-typing ambiguity.
 */
export async function resolveLanding(
  supabase: SupabaseClient<Database>,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "/login";

  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active");

  // A transient DB/RLS failure must not masquerade as "no access".
  if (error) throw error;
  if (!memberships || memberships.length === 0) return "/no-access";
  if (memberships.length > 1) return "/select-org";

  const { data: org } = await supabase
    .from("orgs")
    .select("slug")
    .eq("id", memberships[0].org_id)
    .single();

  return org ? `/${org.slug}` : "/no-access";
}
