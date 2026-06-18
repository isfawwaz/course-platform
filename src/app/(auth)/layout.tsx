/**
 * Public auth surface (login / signup / accept-invite). Default slate theme — no per-org
 * branding here (design system §10: public pages are centered, minimal, trustworthy).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">
            Course Platform
          </h1>
        </div>
        {children}
      </div>
    </div>
  );
}
