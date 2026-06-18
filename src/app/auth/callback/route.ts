import { NextResponse } from "next/server";

import { resolveLanding } from "@/lib/auth/landing";
import { redirectBase, safeNext } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

/**
 * PKCE / OAuth callback: exchanges a `code` for a session, then sends the user to a
 * safe `next` or their resolved landing. Used by client-initiated magic-link login.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const base = redirectBase(request, origin);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${base}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${base}/login?error=auth`);
  }

  const dest = next ?? (await resolveLanding(supabase));
  return NextResponse.redirect(`${base}${dest}`);
}
