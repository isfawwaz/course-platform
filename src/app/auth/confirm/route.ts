import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { resolveLanding } from "@/lib/auth/landing";
import { redirectBase, safeNext } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

/**
 * Email-link confirmation (token_hash flow): verifies the OTP for server-initiated
 * flows — invite, signup confirmation, email magic link, recovery — then sends the
 * user to a safe `next` or their resolved landing.
 *
 * Requires the Supabase email templates to point here, e.g.
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=/accept-invite
 * (see the dashboard setup notes for this epic).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const base = redirectBase(request, origin);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${base}/login?error=missing_token`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return NextResponse.redirect(`${base}/login?error=auth`);
  }

  const dest = next ?? (await resolveLanding(supabase));
  return NextResponse.redirect(`${base}${dest}`);
}
