/**
 * Certificate storage keys (RFC-003 §6, Decision DG). PDFs live in the private Supabase
 * Storage `certificates` bucket — NOT R2. Org-scoped prefix so isolation is code-enforced.
 */
export const CERTIFICATES_BUCKET = "certificates";

export function certificatePdfKey(orgId: string, certificateId: string): string {
  return `org/${orgId}/certificates/${certificateId}.pdf`;
}
