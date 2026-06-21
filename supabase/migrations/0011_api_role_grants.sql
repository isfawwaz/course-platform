-- 0011_api_role_grants: make the schema self-sufficient from migrations alone.
--
-- The live Supabase project grants the API roles (anon/authenticated/service_role) BROAD
-- table privileges on `public` and relies on RLS as the only gate — the standard Supabase
-- model. Those grants come from Supabase's platform-managed default privileges, NOT from
-- earlier migrations, so a DB built from migrations alone (a fresh project, or the local
-- CLI stack on PG17 whose `postgres`-owned-table defaults withhold SELECT/DML) ends up with
-- `authenticated` unable to read anything — RLS never even runs. This migration reproduces
-- that platform grant posture so migrations == live, and removes the need for the test-only
-- ensureSupabaseGrants() workaround.
--
-- Verified against project fjfoizybwbsjwzcnuaar (2026-06-21): all 17 public tables already
-- carry exactly these grants for all three roles, so this is idempotent / a no-op on prod.
-- RLS (enabled per-table in 0001–0007) remains the actual access gate.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;

-- Future objects created by the migration owner inherit the same grants.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines  to anon, authenticated, service_role;
