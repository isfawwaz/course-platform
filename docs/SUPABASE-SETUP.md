# Supabase — course-platform

> Epic 0.B applied live on 2026-06-16. This note + the `migrations/` folder mirror what's in the project.

## Project
- **Name:** course-platform
- **Ref / project id:** `fjfoizybwbsjwzcnuaar`
- **Org:** Kribi Agency (`pgemyijicjuwsapgefdr`)
- **Region:** ap-southeast-1 (Singapore)
- **API URL:** `https://fjfoizybwbsjwzcnuaar.supabase.co`
- **Cost:** $0/month (free tier)

## Keys
- **Publishable (recommended, client-safe):** `sb_publishable_fwDD5GndHv8JTQ-LiiYT6w_8J_iaM_I`
- **Legacy anon (JWT, client-safe):** `eyJhbGci...REDACTED` — copy the full anon key from the Supabase dashboard → Project Settings → API. (Client-safe by design, but not committed, to keep secret scanners quiet. Prefer the publishable key above.)
- **service_role:** NOT included here. Copy it from the Supabase dashboard → Project Settings → API. **Server-only — never commit or expose to the client.**

## `.env.local` template (Next.js)
```
NEXT_PUBLIC_SUPABASE_URL=https://fjfoizybwbsjwzcnuaar.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fwDD5GndHv8JTQ-LiiYT6w_8J_iaM_I
SUPABASE_SERVICE_ROLE_KEY=   # paste from dashboard; server-only
```

## What's applied
- **0001_foundation** — `profiles`, `orgs`, `memberships` (+ indexes); `app` helper fns (`role_in`, `is_staff`, `is_member`, `is_platform_admin`, `can_read_profile`); `handle_new_user` trigger on `auth.users`; `touch_updated_at` triggers; RLS enabled + policies on all three.
- **0002_fix_touch_search_path** — pinned `search_path` on the touch fn (advisor fix).
- **0003_content_and_access** — `videos`, `courses`, `modules`, `lessons`, `captions`, `resources`, `enrolments` (+ indexes); `app.is_enrolled` helper; touch triggers; RLS enabled + policies (staff full; students enrolment-gated; videos/captions staff-only).
- **0004_rls_perf** — collapsed duplicate permissive SELECT policies into single SELECT + split writes; wrapped `auth.uid()` in `(select …)`; added covering indexes for all FKs.
- **0005_progress_completions** — `lesson_progress` + `course_completions`; triggers: `create_completion_on_enrol` (pairs a completion to each new enrolment) and `refresh_completion` (auto → `pending_review` when all required lessons done); RLS.
- **0006_assessments** — `assessments` / `assessment_questions` / `assessment_options` / `assessment_attempts`; options are staff-only (answer key never reaches students); RLS.
- **0007_certificates** — `certificates` with snapshot fields (`student_name_snapshot`, `course_title_snapshot`, `org_name_snapshot`) + `revoked_at`/`revoked_reason`; public `app.verify_certificate(code)` RPC reading snapshots.
- **0008_storage_buckets** — `org-assets` (public, images), `thumbnails` (private, images), `certificates` (private, PDF). Video source/HLS stay in R2.
- **0009_bootstrap_helpers** — `app.set_platform_admin(email)` and `app.add_member(email, org_slug, role)`; both REVOKED from anon/authenticated (admin/service-role only).
- Seed (`seed.sql`) — `Nail Art Academy` org (slug `nail-art-academy`, accent `#E11D48`, locale `id`) created.
- Security advisors: **clean** (0 lints). Performance: only "unused index" INFO notes (expected on an empty DB).
- **17 tables total, all RLS-enabled. Full data model live + storage + seed.**

### Automation built into the DB
- New enrolment → a `course_completion` (`in_progress`) is created automatically.
- A lesson flipping to `completed` → if all required lessons in the course are done, the completion moves to `pending_review` automatically (admin then confirms in-app).
- Certificate scoring/issuance and progress writes that need `is_correct` or cross-user data run server-side (service role); RLS covers the rest.

## Repo wiring (Claude Code, `/Users/fawwaz/Coding/course-platform`)
- Copy `migrations/*.sql` → `supabase/migrations/` and link with `supabase link --project-ref fjfoizybwbsjwzcnuaar` (already-applied migrations match remote history).
- Copy `database.types.ts` → `lib/supabase/database.types.ts`. Regenerate after each migration.
- Build the Refine Supabase data provider against the publishable key; service-role client server-only (RFC-002 §8).

## Storage buckets
| Bucket | Visibility | Limit | Types | Use |
|--------|-----------|-------|-------|-----|
| `org-assets` | public | 5 MB | images | studio logos (shown on login/verify) |
| `thumbnails` | private | 5 MB | images | course/video posters (signed URLs) |
| `certificates` | private | 10 MB | PDF | issued certificate PDFs (signed download) |

All writes and private reads go through the server (service role); the client never touches storage directly, so private buckets need no object policies. Video source/HLS lives in R2, not here.

## Bootstrapping (org already seeded)
The `Nail Art Academy` org exists (id `497d249f-6570-4fa3-91df-8de58ac1a1f4`, slug `nail-art-academy`). To wire up people, after they sign up through the app (trigger creates their `profiles` row), run from the SQL editor / service role:
```sql
-- make Fawwaz the platform admin
select app.set_platform_admin('isfawwaz@gmail.com');
-- attach the studio owner
select app.add_member('OWNER_EMAIL@example.com', 'nail-art-academy', 'owner');
```
`add_member` also takes `'admin'` / `'student'`. These helpers are revoked from clients — service-role only.

## Schema status — COMPLETE
All 17 tables from PRD §8 are live with RLS. No further schema migrations needed for the MVP data model.

Remaining DB-adjacent setup (in the repo / dashboard):
- Supabase Storage private buckets for light assets (thumbnails, certificate PDFs). Video source/HLS lives in R2 (not Supabase Storage).
- Seed the first platform admin + nail-studio org (see Bootstrapping above).
- Wire the Refine data provider + server (service-role) client; build the route handlers from RFC-001/003.
