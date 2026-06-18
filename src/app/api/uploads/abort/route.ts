import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";

import { requireStaffOrg } from "@/lib/auth/guards";
import { mediaBucket, s3 } from "@/lib/storage/s3";
import { parseMediaKey } from "@/lib/storage/keys";
import { createClient } from "@/lib/supabase/server";

/** Abort a multipart upload and mark the video failed. Staff-gated by key org. */
export async function POST(req: Request) {
  const { key, uploadId } = await req.json();
  const parsed = key ? parseMediaKey(key) : null;
  if (!parsed || !uploadId) {
    return Response.json({ error: "bad request" }, { status: 422 });
  }

  const supabase = await createClient();
  if (!(await requireStaffOrg(supabase, parsed.orgId))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await s3().send(
    new AbortMultipartUploadCommand({
      Bucket: mediaBucket(),
      Key: key,
      UploadId: uploadId,
    }),
  );

  await supabase
    .from("videos")
    .update({ status: "failed", error: "upload aborted" })
    .eq("id", parsed.videoId);

  return Response.json({ ok: true });
}
