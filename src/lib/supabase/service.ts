import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * SERVICE-ROLE client. ⚠️ BYPASSES RLS — the #1 risk in this codebase (RFC-002 §8, §12).
 *
 * Only use for the narrow operations RLS cannot express: transcode callbacks,
 * certificate issuance, signed-URL minting, platform/org creation, and reads that
 * need cross-user data or `assessment_options.is_correct`.
 *
 * Every caller MUST re-check org + role + enrolment in app code before acting —
 * the database will not stop a bug here. Keep usage in a thin, audited layer.
 * `server-only` makes importing this from client code a build error.
 */
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — required for service-role operations.",
    );
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
