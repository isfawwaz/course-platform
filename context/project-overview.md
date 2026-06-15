# Project Overview

## About

**Course Platform** — a multi-tenant video LMS. Studios (orgs) upload video courses, grant registered
users access, and students earn a **verifiable certificate** on completion. First client: **Nail Art
Academy**, a nail-art studio.

## The problem it solves

A studio wants to sell/deliver structured video training and issue trustworthy certificates, without
paying per-minute for a managed video service (Mux) or leaking content to non-students. The platform
self-hosts video, gates playback per enrolment, and makes each certificate publicly verifiable by code.

## What this repo owns

The **application code** — Next.js app (admin console + student area + public pages), Route Handlers,
and the two background workers (transcode, certificate). The Supabase backend (Postgres schema, RLS,
auth, storage buckets) is **already built and live**; this repo wires to it. See
`context/architecture.md` for the boundary.

## Users / roles

- **Student** — sees only courses they're enrolled in and only their own progress/certs.
- **Admin** / **Owner** — manage everything inside their org (build courses, grant access, confirm
  completions, issue/revoke certs). Owner vs admin differ only on destructive org-level actions.
- **Platform admin** (super-admin) — creates orgs and assigns owners; **no blanket read access** to
  tenant content (by design).

## In scope (MVP)

Course builder, self-hosted video pipeline (upload → HLS transcode → token-gated playback), progress
tracking, admin-confirmed completion, verifiable PDF certificates, informational assessments,
multi-tenant isolation, i18n (Bahasa Indonesia + English).

## Out of scope (Phase 2 / won't-do for MVP)

Paid self-serve enrolment + studio subscription billing, DRM/forensic watermarking, public course
catalogue, analytics dashboards, native mobile apps, audit log, assessments as a hard completion gate.

## Non-negotiable principles

- **Multi-tenant from day one.** Org = tenant; isolation enforced in the database (RLS), not just app
  code. See the invariants in `context/architecture.md`.
- **Verification is the source of truth for certificates**, not the PDF. A forged PDF fails verification.
- **Completion = required lessons watched (95%) + admin confirm.** Assessments never gate completion.

## Success criteria

The nail studio can onboard, upload, build a course, grant students, and have students complete it and
verify their certificates — per the PRD acceptance criteria, with the cross-tenant RLS test suite green.

## Authoritative specs

Full detail lives in the in-repo mirror `docs/` (see `docs/README.md`):
- Product: `docs/01_DOCS/PRD.md`
- Video pipeline: `docs/01_DOCS/RFC-001-video-pipeline.md`
- Multi-tenancy/RLS: `docs/01_DOCS/RFC-002-multitenancy-rls.md`
- Certificates: `docs/01_DOCS/RFC-003-certificates.md`
- Design: `docs/01_DOCS/DESIGN-SYSTEM.md` · Diagrams: `docs/01_DOCS/DIAGRAMS.md`

Cite the spec by name/number when building; don't invent product behaviour.
