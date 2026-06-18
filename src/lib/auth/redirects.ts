/**
 * Only allow internal absolute paths as post-auth redirect targets — never an
 * attacker-supplied external URL (open-redirect guard).
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

/**
 * Base origin for a post-auth redirect. Honors `x-forwarded-host` in production
 * (Vercel / load balancers) where the request origin can be the internal host.
 */
export function redirectBase(request: Request, origin: string): string {
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const isLocal = process.env.NODE_ENV === "development";
  if (!isLocal && forwardedHost) {
    try {
      return new URL(`https://${forwardedHost}`).origin;
    } catch {
      // Malformed forwarded host — fall back to the request origin.
    }
  }
  return origin;
}
