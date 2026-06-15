# Build Plan

**Core principle:** prove the riskiest chain end-to-end before building UI around it. Work in dependency
order, each step shippable and testable. Full ticket-level detail: `docs/01_DOCS/BUILD-PLAN.md`.

**Critical path:** schema/RLS (✅ done) → video pipeline end-to-end → playback authorization →
everything else layers on once those work.

## Phase 0 — Skeleton spike

> Goal: one org, one course, one lesson — uploaded, single-rendition transcoded, watched through the
> token proxy, progress tracked, with RLS on. No polish. Prove the whole chain on one video.

| Epic | What to build | Done when |
|------|---------------|-----------|
| 0.A Repo & tooling | Next.js + Tailwind + shadcn + Refine/Supabase providers, env, lint | App builds; clients typed (✅ scaffold; Refine provider pending) |
| 0.B Schema & RLS core | Wire schema/types; RLS already live | `database.types.ts` matches live DB; RLS on every table (✅) |
| 0.C Auth | Login (email/password + magic link); accept-invite → membership `active` | A user signs up, lands authenticated; invite flips membership to active |
| 0.D Minimal content | `courses`/`modules`/`lessons`/`videos` CRUD (basic Refine forms) | Create a draft course + module + lesson |
| 0.E Video pipeline (single rendition) | `/uploads/sign` + Uppy→R2; `/videos/:id/complete`→enqueue; Fly worker ffmpeg→720p HLS; `/internal/transcode-callback`→ready; Realtime status | A real video reaches `ready` via the worker |
| 0.F Playback + progress | `/lessons/:id/playback` (enrolment check→token); proxy streams R2; hls.js player; `/progress` clamped; 95%→completed | **A seeded student watches a transcoded lesson through the proxy; progress persists & completes; no cross-org read** |

**DoD P0:** the full chain above works on one video, RLS enforced.

## Phase 1 — Core MVP

Course builder (reorder, required toggle, publish guard), full HLS ladder (1080/720/480/360 + poster +
captions, retries, reconciler), students & access (roster, invite, grant/revoke enrolment), student area
(dashboard + player with resume/captions/keyboard), informational assessments (server-scored, never
expose `is_correct`), completion & certificates (confirm/reject → cert row + Crockford code + snapshots →
`@react-pdf` worker → signed download → public `/verify/[code]` + revocation), i18n (id default + en),
email (provider TBD — stub to console until chosen), RLS isolation test suite, super-admin org creation.

**DoD P1:** the nail studio runs the whole flow per PRD acceptance criteria, RLS suite green.

## Phase 2 — Hardening & growth (post-MVP, by demand)

Storyboard scrub sprites, watermarking/DRM, paid self-serve + studio billing, public catalogue,
analytics, native apps, audit log + soft-delete, assessment-as-gate option, JWT-claims RLS optimisation.

## Still-open inputs (don't block P0)

Email provider (Resend vs Postmark); certificate branding (owner signature?); source size cap (~5 GB
assumed); caption sourcing (owner VTT only for MVP).
