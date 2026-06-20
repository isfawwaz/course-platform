import { issueCertificate } from "@/lib/certificates/issue";
import { requireStaffOrg } from "@/lib/auth/guards";
import { enqueueCertificate } from "@/lib/queue/boss";
import { createClient } from "@/lib/supabase/server";

/**
 * Confirm a completion (staff, RFC-003 §3). Only valid from `pending_review`. On confirm:
 * mark `confirmed` (+ reviewer), then if the course has `certificate_enabled`, create the
 * certificate row (snapshots + code) and enqueue the PDF render. Issuance failure to
 * enqueue never rolls back the confirm — the row exists and can be re-enqueued.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ completionId: string }> },
) {
  const { completionId } = await params;
  const supabase = await createClient();

  // cc_select returns the row for staff (or the owning student); the staff re-check below
  // is what actually authorizes the action.
  const { data: completion } = await supabase
    .from("course_completions")
    .select("id, org_id, course_id, user_id, status")
    .eq("id", completionId)
    .maybeSingle();
  if (!completion) return Response.json({ error: "not found" }, { status: 404 });

  const staff = await requireStaffOrg(supabase, completion.org_id);
  if (!staff) return Response.json({ error: "staff only" }, { status: 403 });

  if (completion.status !== "pending_review") {
    return Response.json(
      { error: `cannot confirm from status "${completion.status}"` },
      { status: 409 },
    );
  }

  const { error: updateError } = await supabase
    .from("course_completions")
    .update({
      status: "confirmed",
      confirmed_by: staff.userId,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", completion.id)
    .eq("status", "pending_review"); // guard against a concurrent transition
  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  const { data: course } = await supabase
    .from("courses")
    .select("certificate_enabled")
    .eq("id", completion.course_id)
    .maybeSingle();

  if (!course?.certificate_enabled) {
    return Response.json({ ok: true, certificate: null });
  }

  const result = await issueCertificate(supabase, completion);
  // Enqueue the render; if the queue is down the row still exists for a later re-enqueue.
  try {
    await enqueueCertificate({ certificateId: result.certificateId });
  } catch (err) {
    console.error(
      `[completions] cert ${result.certificateId} created but enqueue failed:`,
      err,
    );
  }

  return Response.json({
    ok: true,
    certificate: { id: result.certificateId, code: result.code },
  });
}
