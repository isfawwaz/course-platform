-- 0004_rls_perf: collapse duplicate permissive SELECT policies, wrap auth.uid() in (select ...), add FK indexes
-- Resolves performance advisors: auth_rls_initplan, multiple_permissive_policies, unindexed_foreign_keys.

-- ===== profiles: fix auth.uid() initplan on update =====
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using ( id = (select auth.uid()) ) with check ( id = (select auth.uid()) );

-- ===== memberships: one SELECT (staff OR self) + staff writes =====
drop policy if exists memberships_staff_all  on public.memberships;
drop policy if exists memberships_self_read   on public.memberships;
create policy memberships_select on public.memberships
  for select using ( app.is_staff(org_id) or user_id = (select auth.uid()) );
create policy memberships_insert on public.memberships
  for insert with check ( app.is_staff(org_id) );
create policy memberships_update on public.memberships
  for update using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
create policy memberships_delete on public.memberships
  for delete using ( app.is_staff(org_id) );

-- ===== courses =====
drop policy if exists courses_staff_all      on public.courses;
drop policy if exists courses_enrolled_read  on public.courses;
create policy courses_select on public.courses
  for select using ( app.is_staff(org_id) or app.is_enrolled(id) );
create policy courses_insert on public.courses
  for insert with check ( app.is_staff(org_id) );
create policy courses_update on public.courses
  for update using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
create policy courses_delete on public.courses
  for delete using ( app.is_staff(org_id) );

-- ===== modules =====
drop policy if exists modules_staff_all     on public.modules;
drop policy if exists modules_enrolled_read on public.modules;
create policy modules_select on public.modules
  for select using ( app.is_staff(org_id) or app.is_enrolled(course_id) );
create policy modules_insert on public.modules
  for insert with check ( app.is_staff(org_id) );
create policy modules_update on public.modules
  for update using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
create policy modules_delete on public.modules
  for delete using ( app.is_staff(org_id) );

-- ===== lessons =====
drop policy if exists lessons_staff_all     on public.lessons;
drop policy if exists lessons_enrolled_read on public.lessons;
create policy lessons_select on public.lessons
  for select using ( app.is_staff(org_id) or app.is_enrolled(course_id) );
create policy lessons_insert on public.lessons
  for insert with check ( app.is_staff(org_id) );
create policy lessons_update on public.lessons
  for update using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
create policy lessons_delete on public.lessons
  for delete using ( app.is_staff(org_id) );

-- ===== resources =====
drop policy if exists resources_staff_all     on public.resources;
drop policy if exists resources_enrolled_read on public.resources;
create policy resources_select on public.resources
  for select using (
    app.is_staff(org_id)
    or exists (select 1 from public.lessons l where l.id = resources.lesson_id and app.is_enrolled(l.course_id))
  );
create policy resources_insert on public.resources
  for insert with check ( app.is_staff(org_id) );
create policy resources_update on public.resources
  for update using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
create policy resources_delete on public.resources
  for delete using ( app.is_staff(org_id) );

-- ===== enrolments: one SELECT (staff OR self) + staff writes =====
drop policy if exists enrolments_staff_all  on public.enrolments;
drop policy if exists enrolments_self_read  on public.enrolments;
create policy enrolments_select on public.enrolments
  for select using ( app.is_staff(org_id) or user_id = (select auth.uid()) );
create policy enrolments_insert on public.enrolments
  for insert with check ( app.is_staff(org_id) );
create policy enrolments_update on public.enrolments
  for update using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
create policy enrolments_delete on public.enrolments
  for delete using ( app.is_staff(org_id) );

-- ===== covering indexes for foreign keys =====
create index idx_captions_org          on public.captions(org_id);
create index idx_courses_created_by    on public.courses(created_by);
create index idx_enrolments_granted_by on public.enrolments(granted_by);
create index idx_enrolments_org        on public.enrolments(org_id);
create index idx_lessons_module        on public.lessons(module_id);
create index idx_lessons_org           on public.lessons(org_id);
create index idx_modules_org           on public.modules(org_id);
create index idx_resources_org         on public.resources(org_id);
create index idx_videos_uploaded_by    on public.videos(uploaded_by);
