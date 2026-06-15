-- 0001_foundation: orgs, profiles, memberships + helpers + RLS (RFC-002)

create schema if not exists app;

-- ---------- Tables ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  avatar_key text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_key text,
  theme_accent text,
  locale text not null default 'id' check (locale in ('id','en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','admin','student')),
  status text not null default 'invited' check (status in ('invited','active','disabled')),
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index idx_memberships_user on public.memberships(user_id, org_id, status);
create index idx_memberships_org on public.memberships(org_id, status);

-- ---------- Helper functions (SECURITY DEFINER; bypass RLS to authorise policies) ----------
create or replace function app.role_in(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select m.role from public.memberships m
  where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active'
  limit 1
$$;

create or replace function app.is_staff(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select app.role_in(p_org) in ('owner','admin')
$$;

create or replace function app.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select app.role_in(p_org) is not null
$$;

create or replace function app.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function app.can_read_profile(p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_target = auth.uid()
      or exists (
        select 1 from public.memberships staff
        join public.memberships tgt on tgt.org_id = staff.org_id
        where staff.user_id = auth.uid() and staff.status = 'active'
          and staff.role in ('owner','admin')
          and tgt.user_id = p_target
      )
$$;

-- ---------- Auto-create profile on signup ----------
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ---------- updated_at touch ----------
create or replace function app.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger touch_profiles    before update on public.profiles    for each row execute function app.touch_updated_at();
create trigger touch_orgs        before update on public.orgs        for each row execute function app.touch_updated_at();
create trigger touch_memberships before update on public.memberships for each row execute function app.touch_updated_at();

-- ---------- RLS ----------
alter table public.profiles    enable row level security;
alter table public.orgs        enable row level security;
alter table public.memberships enable row level security;

-- profiles: self or co-org staff may read; self may update
create policy profiles_read on public.profiles
  for select using ( app.can_read_profile(id) );
create policy profiles_self_update on public.profiles
  for update using ( id = auth.uid() ) with check ( id = auth.uid() );

-- orgs: members read; staff update; platform admin insert/delete
create policy orgs_member_read on public.orgs
  for select using ( app.is_member(id) );
create policy orgs_staff_update on public.orgs
  for update using ( app.is_staff(id) ) with check ( app.is_staff(id) );
create policy orgs_platform_insert on public.orgs
  for insert with check ( app.is_platform_admin() );
create policy orgs_platform_delete on public.orgs
  for delete using ( app.is_platform_admin() );

-- memberships: staff manage all in org; user reads own
create policy memberships_staff_all on public.memberships
  for all using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
create policy memberships_self_read on public.memberships
  for select using ( user_id = auth.uid() );

-- ---------- Grants ----------
grant usage on schema app to anon, authenticated;
grant execute on all functions in schema app to anon, authenticated;
