import { GetObjectCommand } from "@aws-sdk/client-s3";

import { verifyPlaybackToken } from "@/lib/playback/token";
import { videoHlsPrefix } from "@/lib/storage/keys";
import { mediaBucket, s3 } from "@/lib/storage/s3";

/**
 * Token-gated playback proxy (RFC-001 §8). Validates the video-scoped token, then streams
 * the requested HLS object from private storage. Manifests are rewritten so child playlist
 * and segment URLs carry the same token (no public URLs, one token lifecycle).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ videoId: string; path: string[] }> },
) {
  const { videoId, path } = await params;
  const token = new URL(req.url).searchParams.get("t");
  if (!token) return new Response("missing token", { status: 401 });

  const claims = await verifyPlaybackToken(token);
  if (!claims || claims.videoId !== videoId) {
    return new Response("forbidden", { status: 403 });
  }

  const segments = (path ?? []).filter((p) => p && p !== "..");
  const key = `${videoHlsPrefix(claims.orgId, videoId)}/${segments.join("/")}`;

  let obj;
  try {
    obj = await s3().send(
      new GetObjectCommand({ Bucket: mediaBucket(), Key: key }),
    );
  } catch {
    return new Response("not found", { status: 404 });
  }
  if (!obj.Body) return new Response("not found", { status: 404 });
  const last = segments[segments.length - 1] ?? "";

  // Manifests must be buffered to rewrite child URLs with the token.
  if (last.endsWith(".m3u8")) {
    const rewritten = new TextDecoder()
      .decode(await obj.Body.transformToByteArray())
      .split("\n")
      .map((line) => {
        const t = line.trim();
        if (!t || t.startsWith("#")) return line;
        return `${t}${t.includes("?") ? "&" : "?"}t=${token}`;
      })
      .join("\n");
    return new Response(rewritten, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": "no-store",
      },
    });
  }

  // Segments stream straight through — no full-file buffering.
  return new Response(obj.Body.transformToWebStream(), {
    headers: {
      "content-type": last.endsWith(".ts")
        ? "video/mp2t"
        : (obj.ContentType ?? "application/octet-stream"),
      "cache-control": "private, max-age=60",
    },
  });
}
