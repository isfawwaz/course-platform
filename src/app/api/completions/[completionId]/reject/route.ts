import { requireStaffOrg } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

/**
 * Reject a completion (staff, RFC-003 §3). Only valid from `pending_review`; no certificate
 * is issued. Records the reviewer in `confirmed_by`/`confirmed_at` (the only reviewer fields).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ completionId: string }> },
) {
  const { completionId } = await params;
  const supabase = await createClient();

  const { data: completion } = await supabase
    .from("course_completions")
    .select("id, org_id, status")
    .eq("id", completionId)
    .maybeSingle();
  if (!completion) return Response.json({ error: "not found" }, { status: 404 });

  const staff = await requireStaffOrg(supabase, completion.org_id);
  if (!staff) return Response.json({ error: "staff only" }, { status: 403 });

  if (completion.status !== "pending_review") {
    return Response.json(
      { error: `cannot reject from status "${completion.status}"` },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from("course_completions")
    .update({
      status: "rejected",
      confirmed_by: staff.userId,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", completion.id)
    .eq("status", "pending_review");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
