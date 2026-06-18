import { Button } from "@/components/ui/button";

/**
 * Minimal authed org landing — proves login lands somewhere real and the per-org
 * accent applies. Real dashboard (courses, progress) comes in later epics.
 */
export default async function OrgHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  await params;
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your courses will appear here.
      </p>
      <div className="mt-6">
        <Button>Get started</Button>
      </div>
    </div>
  );
}
