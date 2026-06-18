-- 0009_bootstrap_helpers: admin-only functions to seed the first platform admin + org owner.
-- Run from the SQL editor / service role AFTER a user signs up. REVOKED from anon/authenticated
-- so a client can never self-promote.

create or replace function app.set_platform_admin(p_email text)
returns void language sql security definer set search_path = public as $$
  update public.profiles set is_platform_admin = true where email = p_email;
$$;

create or replace function app.add_member(p_email text, p_org_slug text, p_role text default 'owner')
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid;
  v_org uuid;
begin
  select id into v_uid from public.profiles where email = p_email;
  select id into v_org from public.orgs where slug = p_org_slug;
  if v_uid is null then raise exception 'no profile for email %', p_email; end if;
  if v_org is null then raise exception 'no org with slug %', p_org_slug; end if;
  insert into public.memberships (org_id, user_id, role, status)
  values (v_org, v_uid, p_role, 'active')
  on conflict (org_id, user_id) do update set role = excluded.role, status = 'active';
end;
$$;

revoke all on function app.set_platform_admin(text)     from public, anon, authenticated;
revoke all on function app.add_member(text, text, text) from public, anon, authenticated;
