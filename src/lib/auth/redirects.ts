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
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  if (!isLocal && forwardedHost) return `https://${forwardedHost}`;
  return origin;
}
