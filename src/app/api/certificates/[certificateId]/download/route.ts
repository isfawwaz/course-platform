import { requireStaffOrg } from "@/lib/auth/guards";
import { CERTIFICATES_BUCKET } from "@/lib/certificates/keys";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

/**
 * Signed download for a certificate PDF (RFC-003 §6 step 5). The `certificates` bucket is
 * private with no object policies, so the short-lived signed URL is minted with the service
 * client. Because the service role bypasses RLS, we re-check authorization explicitly in
 * code (invariant §1): the caller must be the certificate's owner or staff of its org.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ certificateId: string }> },
) {
  const { certificateId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { data: cert, error: certError } = await supabase
    .from("certificates")
    .select("id, org_id, user_id, pdf_key")
    .eq("id", certificateId)
    .maybeSingle();
  if (certError) {
    return Response.json({ error: certError.message }, { status: 500 });
  }
  if (!cert) return Response.json({ error: "not found" }, { status: 404 });

  // Explicit authz before the service-role operation: owner, or staff of the cert's org.
  const isOwner = cert.user_id === user.id;
  const isStaff = isOwner ? false : Boolean(await requireStaffOrg(supabase, cert.org_id));
  if (!isOwner && !isStaff) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  if (!cert.pdf_key) {
    return Response.json({ error: "certificate not ready" }, { status: 409 });
  }

  const admin = createServiceClient();
  const { data: signed, error } = await admin.storage
    .from(CERTIFICATES_BUCKET)
    .createSignedUrl(cert.pdf_key, 60, { download: `certificate-${cert.id}.pdf` });
  if (error || !signed) {
    return Response.json(
      { error: error?.message ?? "could not sign url" },
      { status: 500 },
    );
  }

  return Response.redirect(signed.signedUrl, 302);
}
