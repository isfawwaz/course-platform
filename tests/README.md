# Tests

## RLS isolation matrix (`rls-isolation.test.ts`)

The executable proof of **architecture invariant #1**: even a buggy handler must not
leak cross-org data. It builds two independent tenant orgs and asserts, by probing the
real policies in `supabase/migrations/` **as `authenticated`/`anon` end users**, that
neither org can read or write the other's rows — while legitimate same-org access still
works (so it's not a vacuous deny-all).

### How it works

- Connects to the local Supabase Postgres as the superuser `postgres` — used only to
  build fixtures and to switch into an impersonated role per probe.
- `asUser(client, uid, fn)` runs each probe inside a rolled-back transaction with
  `set local role authenticated` + the JWT `sub` claim that `app.*` helpers read via
  `auth.uid()`. Write probes therefore never mutate the shared fixture.
- `ensureSupabaseGrants()` reproduces the broad table grants the **live** project has
  (the local PG17 stack withholds them for `postgres`-owned tables), so the test
  exercises RLS, not table grants. See the docstring in `helpers/db.ts`.

### Running locally

```bash
bun run db:test:up     # boot a slim local Supabase stack (db + auth), applies migrations
bun run test           # run the suite (defaults to 127.0.0.1:54322)
bun run db:test:down   # stop the stack
```

Requires Docker. Override the connection with `TEST_DATABASE_URL` if your db port differs.

CI runs the same flow in `.github/workflows/ci.yml`.
