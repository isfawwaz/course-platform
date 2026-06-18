# Course Platform — Portable Project Context

> Paste this into the **Current Projects & Context** section of your global instructions
> (global CLAUDE.md) so it's available from any folder. Last updated: 2026-06-16.

## Course Platform — multi-tenant video LMS
Studios (orgs) upload video courses, grant registered users access, students earn a verifiable certificate on completion. First client/use case: a nail art studio. Audience for docs: build reference (technical).

**Status:** Planning + design + the entire Supabase backend are DONE and verified. Remaining work is application code (build in Claude Code).

**Where things live**
- Planning/design docs (Cowork): `Cowork OS v2/Outputs/Course Platform/01_DOCS/` — PRD.md, RFC-001-video-pipeline, RFC-002-multitenancy-rls, RFC-003-certificates, DIAGRAMS.md, BUILD-PLAN.md, DESIGN-SYSTEM.md.
- DB artefacts (Cowork): `Cowork OS v2/Outputs/Course Platform/db/` — migrations 0001–0009, seed.sql, database.types.ts, SUPABASE-SETUP.md (URL, keys, env, bootstrap steps).
- Project memory (Cowork): `Cowork OS v2/Projects/Course Platform/` (CLAUDE.md + memory.md).
- Code repo: `/Users/fawwaz/Coding/course-platform` (Next.js/Refine, built in Claude Code — not reachable from Cowork).

**Stack:** Next.js (App Router) + Refine.js (admin/platform consoles, Supabase data provider) + Supabase (Postgres/Auth/RLS/Realtime/Storage). Student area custom Next.js. Video self-hosted on Cloudflare R2 with custom ffmpeg→HLS→token-proxy playback. Tailwind + shadcn/ui. i18n id+en.

**Supabase project (live):** name `course-platform`, ref `fjfoizybwbsjwzcnuaar`, org Kribi Agency (`pgemyijicjuwsapgefdr`), region ap-southeast-1, $0/mo. URL `https://fjfoizybwbsjwzcnuaar.supabase.co`. 17 tables (migrations 0001–0009), all RLS-enabled, security advisors clean. DB automation: enrolment auto-creates a completion; all-required-lessons-done auto → pending_review. Storage buckets: org-assets (public), thumbnails + certificates (private). Seeded org: Nail Art Academy (slug `nail-art-academy`, accent `#E11D48`, locale id). Post-signup bootstrap: `select app.set_platform_admin('isfawwaz@gmail.com');` then `select app.add_member('owner_email','nail-art-academy','owner');`.

**Locked decisions:** admin-grants access (no paid self-serve in MVP); multi-tenant from day one; completion = required lessons watched (95%) + admin confirm → auto verifiable PDF certificate; assessments informational (don't gate); certificates use snapshot fields + public `verify_certificate` RPC; pg-boss queue; Fly.io transcode worker; Uppy multipart upload; design system = clean/minimal, neutral slate base, per-org accent, light-only. Platform billing for studios = Phase 2.

**Next:** build in Claude Code — Next.js/Refine scaffold + schema/types wiring, route handlers from RFC-001/003 (uploads/playback/progress/completions/certs), transcode + certificate workers; set up Storage usage; bootstrap roles after first signups.
