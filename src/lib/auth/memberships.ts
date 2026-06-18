import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

/**
 * Flip the caller's own `invited` memberships to `active`.
 *
 * RLS lets only staff write memberships (`memberships_staff_all`), so a user activating
 * their OWN invite is the documented exception — done with the service client but strictly
 * scoped to `user_id = <caller's uid>` and `status = 'invited'` (invariant #1: re-check in
 * code, never trust the service role blindly). Idempotent: re-running activates nothing new.
 *
 * `userId` must come from the authenticated session, never from client input.
 */
export async function activateInvitedMemberships(
  userId: string,
): Promise<number> {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("memberships")
    .update({ status: "active" })
    .eq("user_id", userId)
    .eq("status", "invited")
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}
