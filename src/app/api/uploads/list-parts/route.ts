import { ListPartsCommand } from "@aws-sdk/client-s3";

import { requireStaffOrg } from "@/lib/auth/guards";
import { mediaBucket, s3 } from "@/lib/storage/s3";
import { parseMediaKey } from "@/lib/storage/keys";
import { createClient } from "@/lib/supabase/server";

/** List already-uploaded parts (Uppy uses this to resume). Staff-gated by key org. */
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

  const out = await s3().send(
    new ListPartsCommand({
      Bucket: mediaBucket(),
      Key: key,
      UploadId: uploadId,
    }),
  );

  const parts = (out.Parts ?? []).map((p) => ({
    PartNumber: p.PartNumber,
    Size: p.Size,
    ETag: p.ETag,
  }));
  return Response.json(parts);
}
