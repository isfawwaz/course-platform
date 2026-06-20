import { requireStaffOrg } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

/**
 * Revoke a certificate (staff, RFC-003 §8). Never deletes the row — sets `revoked` so the
 * public verification page immediately shows the revoked state. Optional `reason` (DJ).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ certificateId: string }> },
) {
  const { certificateId } = await params;
  const supabase = await createClient();

  const { data: cert } = await supabase
    .from("certificates")
    .select("id, org_id, revoked")
    .eq("id", certificateId)
    .maybeSingle();
  if (!cert) return Response.json({ error: "not found" }, { status: 404 });

  const staff = await requireStaffOrg(supabase, cert.org_id);
  if (!staff) return Response.json({ error: "staff only" }, { status: 403 });

  if (cert.revoked) return Response.json({ ok: true, alreadyRevoked: true });

  const reason =
    (await req
      .json()
      .then((b) => (typeof b?.reason === "string" ? b.reason.trim() : ""))
      .catch(() => "")) || null;

  const { error } = await supabase
    .from("certificates")
    .update({
      revoked: true,
      revoked_at: new Date().toISOString(),
      revoked_reason: reason,
    })
    .eq("id", cert.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
