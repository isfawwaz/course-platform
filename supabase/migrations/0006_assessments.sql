-- 0006_assessments: assessments/questions/options/attempts + RLS (PRD §8, informational assessment)

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  pass_score integer check (pass_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id)
);

create table public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  prompt text not null,
  type text not null default 'single' check (type in ('single','multiple')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.assessment_options (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  question_id uuid not null references public.assessment_questions(id) on delete cascade,
  label text not null,
  is_correct boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  enrolment_id uuid not null references public.enrolments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  score integer not null default 0 check (score between 0 and 100),
  passed boolean not null default false,
  submitted_at timestamptz not null default now()
);

-- ---------- Indexes (FK covering) ----------
create index idx_assessments_org on public.assessments(org_id);
create index idx_aq_assessment   on public.assessment_questions(assessment_id);
create index idx_aq_org          on public.assessment_questions(org_id);
create index idx_ao_question     on public.assessment_options(question_id);
create index idx_ao_org          on public.assessment_options(org_id);
create index idx_aa_assessment   on public.assessment_attempts(assessment_id);
create index idx_aa_enrolment    on public.assessment_attempts(enrolment_id);
create index idx_aa_user         on public.assessment_attempts(user_id);
create index idx_aa_org          on public.assessment_attempts(org_id);

-- ---------- touch ----------
create trigger touch_assessments before update on public.assessments for each row execute function app.touch_updated_at();

-- ---------- RLS ----------
alter table public.assessments          enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_options   enable row level security;
alter table public.assessment_attempts  enable row level security;

-- assessments: staff full; enrolled students read
create policy assessments_select on public.assessments
  for select using ( app.is_staff(org_id) or app.is_enrolled(course_id) );
create policy assessments_insert on public.assessments
  for insert with check ( app.is_staff(org_id) );
create policy assessments_update on public.assessments
  for update using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
create policy assessments_delete on public.assessments
  for delete using ( app.is_staff(org_id) );

-- questions: staff full; enrolled students read (no answer key here)
create policy aq_select on public.assessment_questions
  for select using (
    app.is_staff(org_id)
    or exists (select 1 from public.assessments a where a.id = assessment_id and app.is_enrolled(a.course_id))
  );
create policy aq_insert on public.assessment_questions
  for insert with check ( app.is_staff(org_id) );
create policy aq_update on public.assessment_questions
  for update using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
create policy aq_delete on public.assessment_questions
  for delete using ( app.is_staff(org_id) );

-- options: staff ONLY (is_correct must never reach students; server returns sanitised options)
create policy ao_staff_all on public.assessment_options
  for all using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );

-- attempts: student reads own; staff read all. Inserts (scored) via server/service-role.
create policy aa_select on public.assessment_attempts
  for select using ( user_id = (select auth.uid()) or app.is_staff(org_id) );
