/**
 * Authenticated account-level pages that aren't org-scoped yet (org picker, no-access).
 * Centered, default theme. The proxy guarantees a session before these render.
 */
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
