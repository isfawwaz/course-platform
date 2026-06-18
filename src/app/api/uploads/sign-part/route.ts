import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { requireStaffOrg } from "@/lib/auth/guards";
import { mediaBucket, s3 } from "@/lib/storage/s3";
import { parseMediaKey } from "@/lib/storage/keys";
import { createClient } from "@/lib/supabase/server";

/** Presign a single part PUT. Authz: caller must be staff of the org that owns the key. */
export async function POST(req: Request) {
  const { key, uploadId, partNumber } = await req.json();
  const parsed = key ? parseMediaKey(key) : null;
  if (!parsed || !uploadId || !partNumber) {
    return Response.json({ error: "bad request" }, { status: 422 });
  }

  const supabase = await createClient();
  if (!(await requireStaffOrg(supabase, parsed.orgId))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const url = await getSignedUrl(
    s3(),
    new UploadPartCommand({
      Bucket: mediaBucket(),
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn: 60 * 30 },
  );

  return Response.json({ method: "PUT", url });
}
