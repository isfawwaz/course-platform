export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">
          Course Platform
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Multi-tenant video LMS. Scaffold is up — Phase 0 in progress.
        </p>
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          Next.js 16 · Supabase · Refine
        </p>
      </div>
    </main>
  );
}
