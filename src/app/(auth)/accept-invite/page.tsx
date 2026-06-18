import { redirect } from "next/navigation";

import { resolveLanding } from "@/lib/auth/landing";
import { activateInvitedMemberships } from "@/lib/auth/memberships";
import { createClient } from "@/lib/supabase/server";

import { AcceptInviteClient } from "./accept-invite-client";

/**
 * Landing for invited users (they arrive here via the invite email → /auth/confirm).
 * Auto-activates any pending invite for the signed-in account, then offers to set a
 * password before continuing into the org. Activation is idempotent.
 */
export default async function AcceptInvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirect=/accept-invite");
  }

  const activated = await activateInvitedMemberships(user.id);
  const destination = await resolveLanding(supabase);

  return (
    <AcceptInviteClient activated={activated} destination={destination} />
  );
}
