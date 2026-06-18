-- 0005_progress_completions: lesson_progress + course_completions + automation + RLS (PRD §8, RFC-001/003)

-- ---------- Tables ----------
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  enrolment_id uuid not null references public.enrolments(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  watched_sec integer not null default 0 check (watched_sec >= 0),
  last_position_sec integer not null default 0 check (last_position_sec >= 0),
  percent integer not null default 0 check (percent between 0 and 100),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrolment_id, lesson_id)
);

create table public.course_completions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  enrolment_id uuid not null references public.enrolments(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  lessons_completed_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress','pending_review','confirmed','rejected')),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrolment_id)
);

-- ---------- Indexes (incl. FK covering) ----------
create index idx_lp_lesson      on public.lesson_progress(lesson_id);
create index idx_lp_user        on public.lesson_progress(user_id);
create index idx_lp_org         on public.lesson_progress(org_id);
create index idx_cc_course      on public.course_completions(course_id);
create index idx_cc_user        on public.course_completions(user_id);
create index idx_cc_confirmedby on public.course_completions(confirmed_by);
create index idx_cc_org_status  on public.course_completions(org_id, status);

-- ---------- updated_at touch ----------
create trigger touch_lesson_progress    before update on public.lesson_progress    for each row execute function app.touch_updated_at();
create trigger touch_course_completions before update on public.course_completions for each row execute function app.touch_updated_at();

-- ---------- Automation: create completion when an enrolment is granted (PRD AC US5) ----------
create or replace function app.create_completion_on_enrol()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.course_completions (org_id, enrolment_id, course_id, user_id, status)
  values (new.org_id, new.id, new.course_id, new.user_id, 'in_progress')
  on conflict (enrolment_id) do nothing;
  return new;
end;
$$;

create trigger trg_create_completion
  after insert on public.enrolments
  for each row execute function app.create_completion_on_enrol();

-- ---------- Automation: move completion to pending_review when all required lessons done ----------
create or replace function app.refresh_completion()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_course uuid;
  v_required int;
  v_done int;
begin
  select e.course_id into v_course from public.enrolments e where e.id = new.enrolment_id;
  if v_course is null then return new; end if;

  select count(*) into v_required
    from public.lessons l where l.course_id = v_course and l.required = true;

  select count(*) into v_done
    from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id
    where lp.enrolment_id = new.enrolment_id and l.required = true and lp.completed = true;

  if v_required > 0 and v_done >= v_required then
    update public.course_completions
      set status = 'pending_review',
          lessons_completed_at = coalesce(lessons_completed_at, now()),
          updated_at = now()
      where enrolment_id = new.enrolment_id and status = 'in_progress';
  end if;
  return new;
end;
$$;

create trigger trg_refresh_completion
  after insert or update of completed on public.lesson_progress
  for each row when (new.completed = true)
  execute function app.refresh_completion();

-- ---------- RLS ----------
alter table public.lesson_progress    enable row level security;
alter table public.course_completions enable row level security;

-- lesson_progress: student reads/writes own (must own the active enrolment); staff read
create policy lp_select on public.lesson_progress
  for select using ( user_id = (select auth.uid()) or app.is_staff(org_id) );
create policy lp_insert on public.lesson_progress
  for insert with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.enrolments e
                where e.id = enrolment_id and e.user_id = (select auth.uid()) and e.status = 'active')
  );
create policy lp_update on public.lesson_progress
  for update using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

-- course_completions: student reads own; staff read + update (confirm/reject). Inserts/transitions via definer triggers.
create policy cc_select on public.course_completions
  for select using ( user_id = (select auth.uid()) or app.is_staff(org_id) );
create policy cc_update on public.course_completions
  for update using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
