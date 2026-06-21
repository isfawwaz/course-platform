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
  // This connection runs privileged, destructive helpers (ensureSupabaseGrants,
  // fixture teardown) as superuser. Refuse to touch a non-local DB unless explicitly
  // opted in, so a stray TEST_DATABASE_URL can never broaden grants or delete real data.
  const host = new URL(TEST_DB_URL).hostname;
  if (
    !["127.0.0.1", "localhost", "::1"].includes(host) &&
    process.env.ALLOW_NON_LOCAL_TEST_DB !== "true"
  ) {
    throw new Error(
      `Refusing to run privileged test DB helpers against non-local host: ${host}`,
    );
  }
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

const IDENT = /^[a-z_][a-z0-9_]*$/i;

/** Count rows a probe can see — the core isolation primitive. */
export async function visibleCount(
  q: QueryFn,
  table: string,
  whereCol: string,
  value: string,
): Promise<number> {
  // `table`/`whereCol` are interpolated, not parameterized (identifiers can't be
  // bound). Whitelist them so this exported helper can't be reused for injection.
  const parts = table.split(".");
  if (parts.length !== 2 || !parts.every((p) => IDENT.test(p)) || !IDENT.test(whereCol)) {
    throw new Error(`Unsafe identifier in visibleCount: ${table}.${whereCol}`);
  }
  const { rows } = await q<{ n: string }>(
    `select count(*)::text as n from ${table} where ${whereCol} = $1`,
    [value],
  );
  return Number(rows[0]?.n ?? "0");
}
