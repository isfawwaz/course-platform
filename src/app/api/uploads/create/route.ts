import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";

import { requireStaffOrg, resolveOrgIdBySlug } from "@/lib/auth/guards";
import { mediaBucket, s3 } from "@/lib/storage/s3";
import { videoSourceKey } from "@/lib/storage/keys";
import { createClient } from "@/lib/supabase/server";

/**
 * Start a multipart upload: staff-gated, creates the `videos` row (status `uploading`)
 * and the S3 multipart upload. Returns { uploadId, key } for Uppy.
 */
export async function POST(req: Request) {
  const { orgSlug, filename, contentType, title } = await req.json();
  if (!orgSlug || !filename) {
    return Response.json({ error: "orgSlug and filename required" }, { status: 422 });
  }

  const supabase = await createClient();
  const orgId = await resolveOrgIdBySlug(supabase, orgSlug);
  if (!orgId) return Response.json({ error: "not found" }, { status: 404 });

  const staff = await requireStaffOrg(supabase, orgId);
  if (!staff) return Response.json({ error: "forbidden" }, { status: 403 });

  const videoId = crypto.randomUUID();
  const ext = filename.includes(".") ? filename.split(".").pop()! : "bin";
  const key = videoSourceKey(orgId, videoId, ext);
  const bucket = mediaBucket();

  const { error: insertError } = await supabase.from("videos").insert({
    id: videoId,
    org_id: orgId,
    title: title || filename,
    original_filename: filename,
    source_key: key,
    storage_bucket: bucket,
    uploaded_by: staff.userId,
    status: "uploading",
  });
  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  let out;
  try {
    out = await s3().send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType || "application/octet-stream",
      }),
    );
  } catch {
    // Roll back the orphaned `uploading` row if storage init fails.
    await supabase.from("videos").delete().eq("id", videoId);
    return Response.json({ error: "could not start upload" }, { status: 502 });
  }

  return Response.json({ uploadId: out.UploadId, key });
}
