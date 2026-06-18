import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

// Next 16 renamed `middleware` → `proxy` (runtime: nodejs, no edge). See
// node_modules/next/dist/docs/.../version-16.md "middleware to proxy".
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
