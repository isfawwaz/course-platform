-- 0003_content_and_access: courses/modules/lessons/videos/captions/resources/enrolments + RLS (PRD §8, RFC-002)
-- NOTE: the SELECT policies created here were superseded by 0004_rls_perf (collapsed to single
-- combined SELECT + split write policies). Kept as applied for migration-history fidelity.

-- ---------- Tables ----------
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  title text not null,
  original_filename text not null,
  status text not null default 'uploading' check (status in ('uploading','processing','ready','failed')),
  storage_bucket text not null,
  source_key text not null,
  hls_manifest_key text,
  duration_sec integer,
  thumbnail_key text,
  size_bytes bigint,
  error text,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  title text not null,
  slug text not null,
  description text,
  thumbnail_key text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  certificate_enabled boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug)
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  video_id uuid references public.videos(id) on delete set null,
  position integer not null default 0,
  required boolean not null default true,
  duration_sec integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.captions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  lang text not null,
  label text not null,
  storage_key text not null,
  created_at timestamptz not null default now()
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null,
  storage_key text not null,
  file_type text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','revoked')),
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, user_id)
);

-- ---------- Indexes ----------
create index idx_videos_org on public.videos(org_id, status);
create index idx_courses_org on public.courses(org_id, status);
create index idx_modules_course on public.modules(course_id, position);
create index idx_lessons_course on public.lessons(course_id, module_id, position);
create index idx_lessons_video on public.lessons(video_id);
create index idx_captions_video on public.captions(video_id);
create index idx_resources_lesson on public.resources(lesson_id);
create index idx_enrolments_course on public.enrolments(course_id, user_id, status);
create index idx_enrolments_user on public.enrolments(user_id, status);

-- ---------- Helper: active enrolment check (SECURITY DEFINER) ----------
create or replace function app.is_enrolled(p_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrolments e
    where e.course_id = p_course and e.user_id = auth.uid() and e.status = 'active'
  )
$$;
grant execute on function app.is_enrolled(uuid) to anon, authenticated;

-- ---------- updated_at touch ----------
create trigger touch_videos     before update on public.videos     for each row execute function app.touch_updated_at();
create trigger touch_courses    before update on public.courses    for each row execute function app.touch_updated_at();
create trigger touch_modules    before update on public.modules    for each row execute function app.touch_updated_at();
create trigger touch_lessons    before update on public.lessons    for each row execute function app.touch_updated_at();
create trigger touch_enrolments before update on public.enrolments for each row execute function app.touch_updated_at();

-- ---------- RLS (enable; policies finalised in 0004) ----------
alter table public.videos     enable row level security;
alter table public.courses    enable row level security;
alter table public.modules    enable row level security;
alter table public.lessons    enable row level security;
alter table public.captions   enable row level security;
alter table public.resources  enable row level security;
alter table public.enrolments enable row level security;

create policy videos_staff_all on public.videos
  for all using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
create policy captions_staff_all on public.captions
  for all using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );

create policy courses_staff_all on public.courses
  for all using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
create policy courses_enrolled_read on public.courses
  for select using ( app.is_enrolled(id) );

create policy modules_staff_all on public.modules
  for all using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
create policy modules_enrolled_read on public.modules
  for select using ( app.is_enrolled(course_id) );

create policy lessons_staff_all on public.lessons
  for all using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
create policy lessons_enrolled_read on public.lessons
  for select using ( app.is_enrolled(course_id) );

create policy resources_staff_all on public.resources
  for all using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
create policy resources_enrolled_read on public.resources
  for select using (
    exists (select 1 from public.lessons l where l.id = resources.lesson_id and app.is_enrolled(l.course_id))
  );

create policy enrolments_staff_all on public.enrolments
  for all using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
create policy enrolments_self_read on public.enrolments
  for select using ( user_id = auth.uid() );
