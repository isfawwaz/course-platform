import { InviteForm } from "./invite-form";

/**
 * Admin console placeholder (staff-gated, inside the Refine provider). Proves the
 * console mounts and lets us exercise the invite flow. Real resources (course builder,
 * roster) arrive in later epics.
 */
export default async function AdminHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-foreground">Admin console</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Course builder and roster coming soon. For now, invite people to the studio.
      </p>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Invite a member
        </h2>
        <InviteForm orgSlug={orgSlug} />
      </section>
    </div>
  );
}
