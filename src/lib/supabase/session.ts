import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "./database.types";

/**
 * Refresh the Supabase session and apply a coarse auth gate.
 *
 * Called from `src/proxy.ts` (Next 16's renamed middleware). Per Next guidance, this is an
 * OPTIMISTIC check only — it keeps tokens fresh and bounces clearly-unauthenticated requests to
 * /login. Real authorization (active membership, role, enrolment) happens in the data layer:
 * `[orgSlug]/layout.tsx` and the Route Handlers (RFC-002 §5, §8).
 */

// Paths reachable without a session. Everything else requires an authenticated user.
const PUBLIC_PREFIXES = ["/login", "/signup", "/accept-invite", "/auth", "/verify"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser() — it refreshes the token
  // and an early return could desync the session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    const redirect = NextResponse.redirect(loginUrl);
    // Preserve any refreshed auth cookies on the redirect response.
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return supabaseResponse;
}
