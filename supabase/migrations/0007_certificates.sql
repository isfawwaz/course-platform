-- 0007_certificates: certificates (snapshot fields, RFC-003 DH/DJ) + public verify RPC

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completion_id uuid not null references public.course_completions(id) on delete cascade,
  code text not null unique,
  student_name_snapshot text not null,
  course_title_snapshot text not null,
  org_name_snapshot text not null,
  pdf_key text,
  issued_at timestamptz not null default now(),
  revoked boolean not null default false,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default now(),
  unique (completion_id)
);

create index idx_cert_course on public.certificates(course_id);
create index idx_cert_user   on public.certificates(user_id);
create index idx_cert_org    on public.certificates(org_id);

-- ---------- RLS ----------
alter table public.certificates enable row level security;

-- student reads own; staff read all; staff issue/revoke (also done via service role on confirm)
create policy cert_select on public.certificates
  for select using ( user_id = (select auth.uid()) or app.is_staff(org_id) );
create policy cert_insert on public.certificates
  for insert with check ( app.is_staff(org_id) );
create policy cert_update on public.certificates
  for update using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
create policy cert_delete on public.certificates
  for delete using ( app.is_staff(org_id) );

-- ---------- Public verification (reads SNAPSHOTS, not live joins; RFC-003 DH) ----------
create or replace function app.verify_certificate(p_code text)
returns table (valid boolean, course_title text, student_name text, org_name text, issued_at timestamptz, revoked boolean)
language sql stable security definer set search_path = public as $$
  select true,
         c.course_title_snapshot,
         c.student_name_snapshot,
         c.org_name_snapshot,
         c.issued_at,
         c.revoked
  from public.certificates c
  where c.code = p_code
$$;

grant execute on function app.verify_certificate(text) to anon, authenticated;
