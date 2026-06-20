// Test-only Postgres access against the local Supabase stack (`bun run db:test:up`).
//
// The connection is the superuser `postgres` role, which BYPASSES RLS — we use it
// only to (a) build fixtures and (b) switch into an impersonated end-user role for
// each probe. Real isolation is asserted by running probes AS `authenticated`/`anon`,
// never as `postgres`.
import { Client } from "pg";

// Default matches `supabase start` (db on 54322). Override in CI if the port differs.
export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export async function connect(): Promise<Client> {
  const client = new Client({ connectionString: TEST_DB_URL });
  await client.connect();
  return client;
}

export type QueryFn = <R extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<{ rows: R[]; rowCount: number | null }>;

/**
 * Run `fn` impersonating a Supabase end user inside a transaction that is always
 * rolled back. We set the `authenticated` role plus the JWT `sub` claim that the
 * `app.*` RLS helpers read through `auth.uid()`. Pass `uid = null` to act as `anon`.
 *
 * The rollback means write probes (INSERT/UPDATE attempts) never mutate the shared
 * fixture, so probes are order-independent and re-runnable.
 */
export async function asUser<T>(
  client: Client,
  uid: string | null,
  fn: (q: QueryFn) => Promise<T>,
): Promise<T> {
  await client.query("begin");
  try {
    const claims = uid
      ? { sub: uid, role: "authenticated" }
      : { role: "anon" };
    // Set the claim GUC while still superuser, then drop into the target role.
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(claims),
    ]);
    await client.query(`set local role ${uid ? "authenticated" : "anon"}`);

    const q = ((text: string, params?: unknown[]) =>
      client.query(text, params)) as unknown as QueryFn;
    return await fn(q);
  } finally {
    await client.query("rollback");
  }
}

/**
 * Reproduce Supabase's platform grant posture on the local stack.
 *
 * In production, `anon`/`authenticated`/`service_role` hold BROAD table privileges
 * (SELECT/INSERT/UPDATE/DELETE) and RLS is the only gate — the standard Supabase
 * model. But the local PG17 stack's default privileges for `postgres`-owned tables
 * (which is how our migrations create them) withhold those privileges, so reads
 * would fail at the grant layer before RLS is ever evaluated — making the isolation
 * test meaningless. This grants the same privileges the live project has, so the
 * test exercises RLS, not table grants. Idempotent; runs as superuser.
 */
export async function ensureSupabaseGrants(client: Client): Promise<void> {
  await client.query(`
    grant usage on schema public to anon, authenticated, service_role;
    grant all on all tables    in schema public to anon, authenticated, service_role;
    grant all on all sequences in schema public to anon, authenticated, service_role;
    alter default privileges for role postgres in schema public
      grant all on tables to anon, authenticated, service_role;
    alter default privileges for role postgres in schema public
      grant all on sequences to anon, authenticated, service_role;
  `);
}

/** Count rows a probe can see — the core isolation primitive. */
export async function visibleCount(
  q: QueryFn,
  table: string,
  whereCol: string,
  value: string,
): Promise<number> {
  const { rows } = await q<{ n: string }>(
    `select count(*)::text as n from ${table} where ${whereCol} = $1`,
    [value],
  );
  return Number(rows[0]?.n ?? "0");
}
