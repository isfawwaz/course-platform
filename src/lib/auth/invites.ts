"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

import { getOrigin } from "./origin";

export type InviteState = { error?: string; notice?: string };

const ROLES = ["owner", "admin", "student"] as const;
type Role = (typeof ROLES)[number];

/**
 * Invite someone to an org by email. Staff-only (owner/admin). Sends a Supabase invite
 * email and creates an `invited` membership; the invitee activates it via /accept-invite.
 *
 * Service-role is used for the invite + membership write (RLS can't express "create an
 * auth user"), but the caller's staff status is re-checked here first (invariant #1).
 * Minimal helper to exercise the invite flow — full roster UI is Epic 1.C.
 */
export async function sendInvite(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const orgSlug = String(formData.get("org_slug") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") ?? "student") as Role;

  if (!email) return { error: "Email is required." };
  if (!ROLES.includes(role)) return { error: "Invalid role." };

  // 1. Authenticated caller, staff in this org (RLS-bound reads).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not signed in." };

  const { data: org } = await supabase
    .from("orgs")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) return { error: "Studio not found, or you don't have access." };

  const { data: myMembership } = await supabase
    .from("memberships")
    .select("role")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (
    !myMembership ||
    (myMembership.role !== "owner" && myMembership.role !== "admin")
  ) {
    return { error: "Only studio staff can invite people." };
  }

  // 2. Service role: invite (or resolve an existing account) + write the membership.
  const admin = createServiceClient();
  const origin = await getOrigin();

  let invitedUserId: string | undefined;
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/confirm?next=/accept-invite`,
    });

  if (inviteError) {
    // Likely already registered — fall back to their existing profile.
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (!existing) return { error: inviteError.message };
    invitedUserId = existing.id;
  } else {
    invitedUserId = invited.user?.id;
  }
  if (!invitedUserId) return { error: "Could not resolve the invited account." };

  const { error: membershipError } = await admin.from("memberships").upsert(
    {
      org_id: org.id,
      user_id: invitedUserId,
      role,
      status: "invited",
      invited_at: new Date().toISOString(),
    },
    { onConflict: "org_id,user_id" },
  );
  if (membershipError) return { error: membershipError.message };

  return { notice: `Invitation sent to ${email}.` };
}
