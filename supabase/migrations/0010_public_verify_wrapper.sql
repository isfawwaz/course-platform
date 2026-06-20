-- 0010_public_verify_wrapper: expose certificate verification to anon via the `public`
-- schema. The verification logic lives in `app.verify_certificate` (0007, RFC-002 §6.4 /
-- RFC-003 §7), but PostgREST only exposes `public` + `graphql_public` — so the `app`
-- function is unreachable from supabase-js. This thin SECURITY DEFINER wrapper delegates to
-- it, keeping the snapshot projection (the one deliberate RLS bypass) defined in one place.

create or replace function public.verify_certificate(p_code text)
returns table (valid boolean, course_title text, student_name text, org_name text, issued_at timestamptz, revoked boolean)
language sql stable security definer set search_path = public, app as $$
  select * from app.verify_certificate(p_code)
$$;

grant execute on function public.verify_certificate(text) to anon, authenticated;
