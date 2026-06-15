# Course Platform — Build-Sequencing Plan

> Phased, ticket-level plan derived from the PRD + RFC-001/002/003.
> Phases map to RFC-001 §15 (P0/P1/P2). Build incrementally; each phase ends shippable.
> **Last updated:** 2026-06-16

---

## Critical Path

The riskiest, most-blocking work first:

1. **Schema + RLS foundation** (RFC-002) — everything sits on it.
2. **Video pipeline end-to-end** (RFC-001) — the hardest integration; prove it on one video before building UI around it.
3. **Playback authorisation** (token proxy) — gates the whole student experience.
4. Everything else layers on once 1–3 work.

---

## Phase 0 — Skeleton (prove the chain)

> Goal: one org, one course, one lesson — uploaded, transcoded, watched end-to-end, progress tracked, with RLS on. No polish.

**Epic 0.A — Repo & tooling**
- [ ] Scaffold Next.js (App Router, TS) + Tailwind + shadcn/ui.
- [ ] Wire Refine with Supabase data + auth + access-control providers.
- [ ] Env/secrets, lint/format, CI skeleton.

**Epic 0.B — Schema & RLS core** (RFC-002)
- [ ] Migration: `orgs`, `profiles`, `memberships` (+ indexes).
- [ ] Helper fns: `role_in`, `is_staff`, `is_member`, `is_platform_admin`.
- [ ] `profiles` trigger on `auth.users` insert.
- [ ] Enable RLS + base policies; CI test asserting RLS on (DE).

**Epic 0.C — Auth**
- [ ] Login (email/password + magic link).
- [ ] Accept-invite flow → membership `active`.

**Epic 0.D — Minimal content**
- [ ] Migration: `courses`, `modules`, `lessons`, `videos` (+ RLS).
- [ ] Create draft course + one module + one lesson (basic Refine forms).

**Epic 0.E — Video pipeline (single rendition)** (RFC-001)
- [ ] `POST /uploads/sign` + Uppy AwsS3 multipart → R2.
- [ ] `POST /videos/:id/complete` → status `processing` + enqueue (pg-boss).
- [ ] Transcode worker on Fly.io: ffmpeg → 720p HLS + poster → R2.
- [ ] `POST /internal/transcode-callback` → status `ready`.
- [ ] Realtime status badge in library.

**Epic 0.F — Playback + progress** (RFC-001 §8–9)
- [ ] `GET /lessons/:id/playback` → enrolment check → token.
- [ ] Playback proxy validates token → streams R2 segments.
- [ ] hls.js player; `POST /progress` (clamped); 95% → lesson `completed`.
- [ ] Seed one enrolment manually; watch end-to-end.

**DoD P0:** a seeded student watches a real transcoded lesson through the token proxy; progress persists and completes; no table is readable cross-org.

---

## Phase 1 — Core MVP

> Goal: the full PRD MVP for the nail studio. Shippable to one real org.

**Epic 1.A — Course builder** (US3)
- [ ] Modules/lessons CRUD with reorder (position), `required` toggle.
- [ ] Attach `ready` video; resources upload (US3); thumbnails.
- [ ] Publish guard: ≥1 required lesson with a ready video.

**Epic 1.B — Full video pipeline** (RFC-001 P1)
- [ ] Full ladder 1080/720/480/360; poster; WebVTT captions.
- [ ] Retries, per-job timeout, reconciler (stuck `processing`/`uploading`).

**Epic 1.C — Students & access** (US5, US6, US8)
- [ ] Roster, invite by email → membership `invited`.
- [ ] Grant/revoke enrolment (+ paired `course_completion` in_progress).
- [ ] Per-student progress + assessment result view.

**Epic 1.D — Student area** (US9, US10)
- [ ] My courses dashboard (progress rings).
- [ ] Course player: sidebar, resume, captions, keyboard, resources.

**Epic 1.E — Assessment** (US4, US11) — informational
- [ ] Assessment builder (questions/options/correct, pass score).
- [ ] Assessment runner; server-side scoring; `assessment_attempts`.
- [ ] Options sanitised server-side (never expose `is_correct`).

**Epic 1.F — Completion & certificates** (US7, US12, US13 / RFC-003)
- [ ] Completions queue; confirm/reject.
- [ ] Cert row + code (Crockford) + snapshots on confirm.
- [ ] Cert worker: `@react-pdf` render + QR → Supabase Storage.
- [ ] `/certificates/:id/download` (signed); My certificates.
- [ ] `/verify/[code]` public page via `verify_certificate` RPC; revocation.

**Epic 1.G — Cross-cutting**
- [ ] i18n (id default + en).
- [ ] Email (provider decision) — invites, "certificate ready".
- [ ] RLS isolation test suite (two-org matrix, RFC-002 §10).
- [ ] Empty/loading/error states; AA accessibility pass.
- [ ] Super-admin: create org + assign owner (US14).

**DoD P1:** the nail studio onboards, uploads, builds a course, grants students, students complete and verify certificates — all per the PRD acceptance criteria, with the RLS suite green.

---

## Phase 2 — Hardening & Growth (post-MVP)

> Not required to ship; sequence by demand.

- [ ] Storyboard scrub sprites; player polish.
- [ ] Forensic/visible watermarking; optional DRM.
- [ ] Paid self-serve enrolment + studio subscription billing.
- [ ] Public course catalogue; ratings.
- [ ] Analytics dashboards (engagement, drop-off).
- [ ] Native mobile apps; discussion/comments.
- [ ] Audit log of staff actions; soft-delete + retention.
- [ ] Assessment as a hard completion gate (per-course option).
- [ ] JWT-claims optimisation if membership subqueries get hot (RFC-002 DB).

---

## Sequencing Notes

- **0.B before everything** — schema/RLS is the foundation; don't build UI on tables without policies.
- **0.E/0.F are the spike** — get one video through the whole pipeline before investing in builder UI.
- **1.F depends on 0.B + queue (0.E)** — certificates reuse the pg-boss queue.
- **Email + provider decision** is the one external dependency still open; invites can stub to console logs until chosen.
- Keep the **RLS test suite** growing alongside each new table, not bolted on at the end.

---

## Still-Open Inputs (don't block P0)

- Email provider (Resend vs Postmark).
- Certificate template/branding — needs the design-system pass (owner signature? layout).
- Source size cap (~5 GB assumed); caption sourcing (owner VTT only for MVP).
- Audit log / soft-delete — Phase 2 unless surfaced sooner.
