import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";

/**
 * Browser Supabase client (publishable key). RLS-enforced — safe for the client.
 * Use in Client Components.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
