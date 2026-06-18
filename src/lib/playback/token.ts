import "server-only";

import { jwtVerify, SignJWT } from "jose";

/**
 * Short-lived, video-scoped playback tokens (RFC-001 §8, D2). Issued only after an
 * enrolment/staff check; the proxy validates them before streaming any segment.
 */
function secret(): Uint8Array {
  const s = process.env.PLAYBACK_TOKEN_SECRET;
  if (!s) throw new Error("PLAYBACK_TOKEN_SECRET is not set.");
  return new TextEncoder().encode(s);
}

export async function signPlaybackToken(
  videoId: string,
  orgId: string,
): Promise<string> {
  return new SignJWT({ orgId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(videoId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret());
}

export async function verifyPlaybackToken(
  token: string,
): Promise<{ videoId: string; orgId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub === "string" && typeof payload.orgId === "string") {
      return { videoId: payload.sub, orgId: payload.orgId };
    }
    return null;
  } catch {
    return null;
  }
}
