import "server-only";

import { headers } from "next/headers";

/**
 * Origin (scheme + host) for building auth email-redirect URLs.
 *
 * Prefers a configured canonical URL (`NEXT_PUBLIC_APP_URL`/`SITE_URL`) so email
 * redirects can't be steered by a forged `x-forwarded-host`. Falls back to the
 * request host (first token only), using https outside development.
 */
export async function getOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? process.env.SITE_URL;
  if (configured) return new URL(configured).origin;

  const h = await headers();
  const rawHost = h.get("x-forwarded-host") ?? h.get("host");
  if (!rawHost) {
    throw new Error("Missing host header while building auth redirect URL.");
  }
  const host = rawHost.split(",")[0]!.trim();
  const proto = process.env.NODE_ENV === "development" ? "http" : "https";
  return new URL(`${proto}://${host}`).origin;
}
