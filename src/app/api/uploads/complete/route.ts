import {
  CompleteMultipartUploadCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

import { requireStaffOrg } from "@/lib/auth/guards";
import { enqueueTranscode } from "@/lib/queue/boss";
import { mediaBucket, s3 } from "@/lib/storage/s3";
import { parseMediaKey } from "@/lib/storage/keys";
import { createClient } from "@/lib/supabase/server";

type Part = { ETag?: string; PartNumber?: number };

/**
 * Finalize the multipart upload, flip the video to `processing`, and enqueue transcode.
 * Collapses Uppy's completeMultipartUpload with RFC-001's /videos/:id/complete step.
 */
export async function POST(req: Request) {
  const { key, uploadId, parts } = (await req.json()) as {
    key?: string;
    uploadId?: string;
    parts?: Part[];
  };
  const parsed = key ? parseMediaKey(key) : null;
  if (!parsed || !uploadId || !parts?.length) {
    return Response.json({ error: "bad request" }, { status: 422 });
  }

  const supabase = await createClient();
  if (!(await requireStaffOrg(supabase, parsed.orgId))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const bucket = mediaBucket();
  const completed = await s3().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .map((p) => ({ ETag: p.ETag, PartNumber: p.PartNumber }))
          .sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0)),
      },
    }),
  );

  let sizeBytes: number | null = null;
  try {
    const head = await s3().send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    sizeBytes = head.ContentLength ?? null;
  } catch {
    // size is best-effort
  }

  const { data: updated, error: updateError } = await supabase
    .from("videos")
    .update({ status: "processing", size_bytes: sizeBytes })
    .eq("id", parsed.videoId)
    .select("id");
  if (updateError || !updated?.length) {
    return Response.json(
      { error: updateError?.message ?? "video not found" },
      { status: 500 },
    );
  }

  await enqueueTranscode({
    videoId: parsed.videoId,
    orgId: parsed.orgId,
    sourceKey: key!,
  });

  return Response.json({ location: completed.Location ?? null });
}
