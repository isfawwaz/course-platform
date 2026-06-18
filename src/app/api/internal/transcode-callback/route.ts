import { createServiceClient } from "@/lib/supabase/service";

/**
 * Worker → app callback that flips a video to `ready` (or `failed`). Authenticated by a
 * shared service token, never callable by clients (RFC-001 §6, §10). Uses the service
 * role because the worker has no user session — the secret check IS the authorization.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-transcode-secret");
  if (!secret || secret !== process.env.TRANSCODE_CALLBACK_SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { videoId, status } = body as { videoId?: string; status?: string };
  if (!videoId || (status !== "ready" && status !== "failed")) {
    return Response.json({ error: "bad request" }, { status: 422 });
  }

  const update =
    status === "ready"
      ? {
          status: "ready",
          hls_manifest_key: body.hlsManifestKey ?? null,
          duration_sec: body.durationSec ?? null,
          thumbnail_key: body.thumbnailKey ?? null,
          error: null,
        }
      : { status: "failed", error: body.error ?? "transcode failed" };

  const admin = createServiceClient();
  const { error } = await admin.from("videos").update(update).eq("id", videoId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
