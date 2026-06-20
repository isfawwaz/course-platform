import { CERTIFICATES_BUCKET } from "@/lib/certificates/keys";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

/**
 * Signed download for a certificate PDF (RFC-003 §6 step 5). The RLS read below is the
 * authorization gate — `cert_select` returns the row only to its owner or org staff. The
 * `certificates` bucket is private with no object policies, so the short-lived signed URL
 * is minted with the service client (after that ownership/staff check).
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

  const { data: cert } = await supabase
    .from("certificates")
    .select("id, pdf_key")
    .eq("id", certificateId)
    .maybeSingle();
  if (!cert) return Response.json({ error: "not found" }, { status: 404 });
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
