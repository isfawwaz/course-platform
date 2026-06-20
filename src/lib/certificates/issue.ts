import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import { generateCertificateCode } from "./code";

/**
 * Create the certificate row for a confirmed completion (RFC-003 §5, §6 step 1).
 *
 * - **Idempotent (Decision DK):** one certificate per completion. If one already exists,
 *   it's returned unchanged — the code never changes on re-issue.
 * - **Snapshots:** student name / course title / org name are frozen at issue time, so a
 *   later rename can't silently rewrite an issued certificate (invariant §5).
 *
 * Runs under the caller's RLS session: `cert_insert` already restricts inserts to staff,
 * and `profiles_read`/`orgs_member_read` let co-org staff read the snapshot sources — so
 * no service-role bypass is needed here. The caller MUST have re-checked staff first.
 * `pdf_key` stays null until the worker renders + uploads the PDF.
 */
export type CompletionForIssue = {
  id: string;
  org_id: string;
  course_id: string;
  user_id: string;
};

export type IssueResult = {
  certificateId: string;
  code: string;
  created: boolean;
};

export async function issueCertificate(
  supabase: SupabaseClient<Database>,
  completion: CompletionForIssue,
): Promise<IssueResult> {
  const existing = await findByCompletion(supabase, completion.id);
  if (existing) return { ...existing, created: false };

  // Snapshot sources (all RLS-readable by co-org staff). A *query* error must fail
  // issuance — never silently fall through to degraded snapshot data.
  const [profileRes, courseRes, orgRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", completion.user_id)
      .maybeSingle(),
    supabase
      .from("courses")
      .select("title")
      .eq("id", completion.course_id)
      .maybeSingle(),
    supabase.from("orgs").select("name").eq("id", completion.org_id).maybeSingle(),
  ]);
  for (const res of [profileRes, courseRes, orgRes]) {
    if (res.error) {
      throw new Error(`certificate snapshot read failed: ${res.error.message}`);
    }
  }
  if (!courseRes.data || !orgRes.data) {
    throw new Error("certificate snapshot sources missing (course/org)");
  }
  const studentName =
    profileRes.data?.full_name?.trim() || profileRes.data?.email || "Student";
  const course = courseRes.data;
  const org = orgRes.data;

  // Insert with code-collision retry. The unique(completion_id) constraint is the backstop
  // against a concurrent double-confirm; unique(code) triggers a fresh-code retry.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCertificateCode();
    const { data, error } = await supabase
      .from("certificates")
      .insert({
        org_id: completion.org_id,
        course_id: completion.course_id,
        user_id: completion.user_id,
        completion_id: completion.id,
        code,
        student_name_snapshot: studentName,
        course_title_snapshot: course.title,
        org_name_snapshot: org.name,
      })
      .select("id, code")
      .single();

    if (!error && data) {
      return { certificateId: data.id, code: data.code, created: true };
    }
    if (error?.code === "23505") {
      // Unique violation: either this completion was issued concurrently, or the code
      // collided. Re-check the completion to tell them apart.
      const race = await findByCompletion(supabase, completion.id);
      if (race) return { ...race, created: false };
      continue; // code collision → retry with a new code
    }
    throw new Error(error?.message ?? "certificate insert failed");
  }
  throw new Error("could not generate a unique certificate code after retries");
}

async function findByCompletion(
  supabase: SupabaseClient<Database>,
  completionId: string,
): Promise<{ certificateId: string; code: string } | null> {
  const { data, error } = await supabase
    .from("certificates")
    .select("id, code")
    .eq("completion_id", completionId)
    .maybeSingle();
  if (error) {
    throw new Error(`certificate lookup by completion failed: ${error.message}`);
  }
  return data ? { certificateId: data.id, code: data.code } : null;
}
