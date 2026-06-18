# RFC-002 — Multi-tenancy & RLS

> **Status:** Accepted — DA–DE locked 2026-06-16
> **Author:** Fawwaz
> **Date:** 2026-06-16
> **Related:** PRD §3, §8 (`01_DOCS/PRD.md`); RFC-001
> **Decision owner:** Eng (Fawwaz)

---

## 1. Summary

How the platform keeps every studio's data fully isolated while running on one shared Supabase Postgres. The tenant is the **org**; isolation is enforced in the database with Row-Level Security (RLS), not just in app code. This RFC defines the membership model, how the active org is resolved, the RLS policy patterns for each table category, and where app code still has to enforce things RLS can't.

**Principle:** the database is the last line of defence. Even if a Route Handler has a bug, RLS should stop one org reading another's data.

---

## 2. Goals / Non-goals

**Goals**
- One user can belong to multiple orgs with a different role in each.
- Deny-by-default: a row is invisible unless a policy grants access.
- Students see only courses they're enrolled in, and only their own progress/attempts.
- Owners/admins manage everything inside their org and nothing outside it.
- Public certificate verification without exposing tenant data.

**Non-goals (this RFC)**
- Billing / subscription scoping (Phase 2).
- Fine-grained per-resource ACLs beyond role (e.g. per-course instructor ownership) — instructor is folded into admin per PRD.
- SSO / SCIM provisioning.

---

## 3. Tenancy Model

- **Org = tenant.** Every tenant-owned table carries `org_id uuid not null`.
- **Shared schema, shared tables, RLS isolation** (not schema-per-tenant, not db-per-tenant). Simplest to operate at this scale; isolation comes from policies + `org_id`.
- **Platform layer** sits above orgs: super-admins create orgs and assign owners. Platform admins do **not** get blanket read access to tenant content (privacy) — they operate through dedicated platform endpoints using the service role for the narrow actions they need. (Decision DA.)

---

## 4. Identity & Membership

```
auth.users (Supabase)
   └─ 1:1 ─ profiles            (app identity; is_platform_admin flag)
                 └─ N ─ memberships ─ N ─ orgs
                         (role: owner | admin | student; status: invited | active | disabled)
```

- `profiles.id = auth.users.id`. Created by a Postgres trigger on `auth.users` insert.
- `memberships` is the join: one row per (user, org), `UNIQUE (org_id, user_id)`. A user with rows in two orgs is a member of both, with independent roles.
- **Role lives on the membership, not the profile** — the same person can be an owner in their own studio and a student in another.
- `is_platform_admin` is the only global flag, on `profiles`.

---

## 5. Active-Org Resolution

- URL carries the org slug: `/[orgSlug]/...`. Server resolves slug → `org_id` and checks the caller has an `active` membership before rendering.
- **The client never supplies a trusted `org_id`.** On writes, the server sets `org_id` from the resolved context (or it's defaulted/checked by policy), so a forged `org_id` in a payload can't place a row in another tenant.
- RLS enforces isolation regardless of routing — routing is UX, policies are security.

---

## 6. RLS Strategy

### 6.1 Principles
- `alter table … enable row level security;` on every tenant table. No table left open.
- Policies are written per command (`select`, `insert`, `update`, `delete`) so reads and writes can differ by role.
- Authorisation is expressed through small **SECURITY DEFINER helper functions** that look up the caller's membership once, keeping policies readable and consistent.

### 6.2 Helper functions

```sql
-- Caller's role in an org, or null if not a member / not active.
create or replace function app.role_in(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select m.role
  from memberships m
  where m.org_id = p_org
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1
$$;

-- Is the caller active staff (owner or admin) in the org?
create or replace function app.is_staff(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select app.role_in(p_org) in ('owner','admin')
$$;

-- Is the caller any active member of the org?
create or replace function app.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select app.role_in(p_org) is not null
$$;

-- Platform super-admin?
create or replace function app.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_admin from profiles where id = auth.uid()), false)
$$;
```

> **Why functions, not JWT claims:** baking org roles into the JWT is faster (no subquery) but goes stale until the token refreshes and gets awkward with multi-org membership and mid-session role changes (e.g. access revoked). For MVP we favour correctness: the helper reads live membership. If profiling shows the subquery is hot, we can add JWT claims via a custom access-token hook later without changing table shapes. (Decision DB.)

### 6.3 Table categories & policy patterns

| Category | Tables | Read | Write |
|----------|--------|------|-------|
| Org content | courses, modules, lessons, videos, captions, resources, assessments, assessment_questions | members of the org | staff (owner/admin) |
| Hidden answer key | assessment_options | staff only (students never read `is_correct`) | staff |
| Access grants | enrolments | staff; student reads own | staff only |
| Student-owned | lesson_progress, assessment_attempts | student reads own; staff read all in org | student writes own; staff no direct write |
| Completion | course_completions | student reads own; staff read/confirm | staff update status; student no write |
| Certificates | certificates | student reads own; staff read all | staff (issue/revoke); public verify via RPC only |
| Org/membership | orgs, memberships | members read own org; staff read memberships | platform admin creates org; staff manage memberships |

### 6.4 Representative policies

**Org content — courses** (members read, staff write):
```sql
alter table courses enable row level security;

create policy courses_read on courses
  for select using ( app.is_member(org_id) );

create policy courses_write on courses
  for all using ( app.is_staff(org_id) )
  with check ( app.is_staff(org_id) );
```

**Student-owned — lesson_progress** (student rw own; staff read):
```sql
alter table lesson_progress enable row level security;

create policy progress_student_rw on lesson_progress
  for all using ( user_id = auth.uid() )
  with check ( user_id = auth.uid() and app.is_member(org_id) );

create policy progress_staff_read on lesson_progress
  for select using ( app.is_staff(org_id) );
```

**Enrolments** (staff manage; student reads own):
```sql
alter table enrolments enable row level security;

create policy enrolments_staff_all on enrolments
  for all using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );

create policy enrolments_student_read on enrolments
  for select using ( user_id = auth.uid() );
```

**Course content gated by enrolment — lessons** (staff full; students only within an enrolled course):
```sql
alter table lessons enable row level security;

create policy lessons_staff_all on lessons
  for all using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );

create policy lessons_enrolled_read on lessons
  for select using (
    exists (
      select 1 from enrolments e
      where e.course_id = lessons.course_id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );
```

**Assessment options** (answer key never leaves the server for students):
```sql
alter table assessment_options enable row level security;

create policy options_staff_only on assessment_options
  for all using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
-- No student read policy. Students get sanitised options (no is_correct)
-- from the /assessments/:id route, which strips the column server-side.
```

**Certificates** (owner of cert + staff read; public verify is a separate RPC):
```sql
alter table certificates enable row level security;

create policy cert_owner_read on certificates
  for select using ( user_id = auth.uid() );

create policy cert_staff_all on certificates
  for all using ( app.is_staff(org_id) ) with check ( app.is_staff(org_id) );
```

```sql
-- Public verification: SECURITY DEFINER RPC returns a minimal projection,
-- callable by anon, bypassing table RLS in a controlled way.
-- Reads SNAPSHOT columns on the certificate (RFC-003 DH), not live joins,
-- so an issued certificate never changes if a course/user is later renamed.
create or replace function app.verify_certificate(p_code text)
returns table (valid boolean, course_title text, student_name text, org_name text, issued_at timestamptz, revoked boolean)
language sql stable security definer set search_path = public as $$
  select true,
         cert.course_title_snapshot,
         cert.student_name_snapshot,
         cert.org_name_snapshot,
         cert.issued_at,
         cert.revoked
  from certificates cert
  where cert.code = p_code
$$;
-- grant execute to anon, authenticated.
```

---

## 7. Roles & Permissions Matrix

| Action | Student | Admin | Owner | Platform admin |
|--------|:------:|:-----:|:-----:|:--------------:|
| View granted courses | ✓ (enrolled) | ✓ | ✓ | — |
| Upload video / build course | — | ✓ | ✓ | — |
| Grant/revoke enrolment | — | ✓ | ✓ | — |
| View any student's progress | — | ✓ | ✓ | — |
| Confirm/reject completion | — | ✓ | ✓ | — |
| Issue/revoke certificate | — | ✓ | ✓ | — |
| Manage memberships | — | ✓ | ✓ | — |
| Delete org / change owner | — | — | ✓* | ✓ |
| Create org / assign owner | — | — | — | ✓ |
| Read tenant content | own only | org | org | **no** (by design) |

\* Owner can manage their own org; cross-org and ownership transfer go through platform tooling. Owner vs admin differ only on destructive org-level actions in MVP; otherwise equivalent.

---

## 8. Enforcement Beyond RLS

RLS covers row visibility, but some things sit outside it:
- **Service-role code bypasses RLS.** Route Handlers that use the service key (transcode callback, cert issuance, signed-URL minting) must re-check org/role/enrolment in code. Treat the service role as "trusted, therefore dangerous".
- **Storage objects** (R2/MinIO source + HLS) aren't Postgres rows — isolation comes from org-scoped keys (`org/{orgId}/...`) and server-issued signed URLs gated by an enrolment/role check (RFC-001 §8). Supabase Storage (light assets bucket) uses its own storage RLS.
- **Setting `org_id` on insert** is server-controlled; `with check` policies confirm the caller is staff/member of that org, blocking cross-tenant inserts.
- **Public RPCs** (`verify_certificate`) are the only deliberate RLS bypass and return minimal projections.

---

## 9. Onboarding Flows

- **New org:** platform admin → `POST /api/orgs` (service role) → create `org` + owner `membership` (`active`) → invite owner via email.
- **Invite student:** staff invites by email → create `membership` (`invited`); if no `auth.users` row, send a magic-link/signup invite; on first login the trigger creates the `profile` and the membership flips to `active` on acceptance.
- **Grant course access:** staff creates an `enrolment` (`active`) + paired `course_completion` (`in_progress`) (PRD AC US5).
- **Cross-org user:** same `auth.users`/`profile`, a second `membership` row — no data duplication.

---

## 10. Isolation Test Plan

Verified with pgTAP / integration tests, two orgs (A, B) and seeded users:
- Student in A cannot select any row of B (courses, lessons, videos, progress, certs).
- Student in A cannot select courses in A they aren't enrolled in.
- Student cannot read `assessment_options.is_correct` by any path.
- Admin in A cannot read or write B's content.
- Forged `org_id` in an insert payload is rejected by `with check`.
- `verify_certificate` returns only the minimal projection and nothing else.
- Revoking an enrolment immediately removes lesson read access.

---

## 11. Performance

- Index `org_id` on every tenant table; add composite indexes matching policy/query shape: `enrolments (course_id, user_id, status)`, `lesson_progress (enrolment_id, lesson_id)`, `memberships (user_id, org_id, status)`, `certificates (code)`.
- Helper functions are `stable` so the planner can cache within a statement.
- Watch policies with nested `exists` (e.g. `lessons_enrolled_read`) on hot paths; the enrolment index keeps them cheap.
- If membership subqueries ever dominate, revisit JWT claims (Decision DB).

---

## 12. Risks / Pitfalls

- **Service role silently bypasses RLS** — the top risk. Mitigate with a thin, audited data layer for service-role operations and explicit re-checks.
- **Forgotten `enable row level security`** leaves a table wide open. Mitigate with a migration lint/test asserting RLS is on for every tenant table.
- **`security definer` functions** must pin `search_path` (done) to avoid hijacking.
- **Trigger-created profiles** failing silently on signup — add a test.
- **Storage isolation** is code-enforced, not RLS — keep key derivation centralised so an org can never be addressed by another.

---

## 13. Decisions (Locked 2026-06-16)

> All recommended options accepted.

| # | Decision | Chosen | Alternatives (rejected) |
|---|----------|-------------|--------------|
| DA | Platform-admin access to tenant content | **No blanket access; narrow service-role tooling** | Blanket read for support |
| DB | RLS authorisation mechanism | **SECURITY DEFINER helper functions (live membership)** | JWT custom claims |
| DC | Tenancy isolation model | **Shared schema + RLS** | Schema-per-tenant; db-per-tenant |
| DD | Owner vs Admin split | **Differ only on destructive org-level actions** | Full separate permission sets |
| DE | RLS regression safety | **Migration test asserts RLS on + policy coverage** | Manual review only |

---

## 14. Open Questions

- Do we need an audit log of staff actions (grants, confirmations, cert issuance) in MVP, or Phase 2?
- Soft-delete vs hard-delete for orgs/courses (affects policies + retention)?
- Should disabled members retain read access to already-earned certificates?
