/**
 * Org-scoped storage keys (RFC-001 §5). Centralised so one org can never address
 * another's objects — every media key is prefixed with its org id.
 */
const base = (orgId: string, videoId: string) =>
  `org/${orgId}/videos/${videoId}`;

export function videoSourceKey(
  orgId: string,
  videoId: string,
  ext: string,
): string {
  const clean = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `${base(orgId, videoId)}/source.${clean}`;
}

export function videoHlsPrefix(orgId: string, videoId: string): string {
  return `${base(orgId, videoId)}/hls`;
}

export function videoMasterKey(orgId: string, videoId: string): string {
  return `${videoHlsPrefix(orgId, videoId)}/master.m3u8`;
}

export function videoPosterKey(orgId: string, videoId: string): string {
  return `${base(orgId, videoId)}/thumbnails/poster.jpg`;
}

/** Parse the org id + video id back out of a media key, validating the shape. */
export function parseMediaKey(
  key: string,
): { orgId: string; videoId: string } | null {
  const m =
    /^org\/([0-9a-f-]{36})\/videos\/([0-9a-f-]{36})\//.exec(key);
  return m ? { orgId: m[1], videoId: m[2] } : null;
}
