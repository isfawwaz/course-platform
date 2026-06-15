@AGENTS.md

# Course Platform — Agent Context

> **Next.js 16 + React 19 + Tailwind v4.** Next 16 has breaking changes vs older training data — read `AGENTS.md` and the relevant guide in `node_modules/next/dist/docs/` before writing framework code.

Multi-tenant video LMS. Studios (orgs) upload video courses, grant registered users access, and students earn a **verifiable certificate** on completion. First client: **Nail Art Academy** (a nail-art studio). Docs are a technical build reference.

> **Status (2026-06-16):** Planning, design, and the **entire Supabase backend** are DONE and verified (17 tables, RLS on, advisors clean). Remaining work is **all application code**.
>
> **Scaffold landed (Epic 0.A + 0.B core):** Next.js 16 + React 19 + Tailwind v4 + shadcn (Radix, slate design-system tokens, Inter/JetBrains fonts); Supabase clients in `src/lib/supabase/` (`client.ts` browser, `server.ts` SSR, `service.ts` service-role + `database.types.ts` for all 17 tables); 9 migrations + seed in `supabase/`; `.env.local`. Build is green. **Not yet done:** Refine `<Refine>` provider wrapper + auth provider (pairs with Epic 0.C auth), `supabase` CLI link, RLS CI test.

---

## Canonical specs (read before building)

The authoritative planning/design docs live **outside this repo**, in Cowork:

```
/Users/fawwaz/Documents/Cowork OS v2/Outputs/Course Platform/
├── 01_DOCS/
│   ├── PRD.md                      # full product spec (US1–US14, data model §8)
│   ├── RFC-001-video-pipeline.md   # upload, transcode, token-proxy playback, progress
│   ├── RFC-002-multitenancy-rls.md # tenancy model, RLS helpers, policy patterns
│   ├── RFC-003-certificates.md     # cert codes, snapshots, PDF pipeline, verify RPC
│   ├── BUILD-PLAN.md               # phased, ticket-level plan (P0 spike → P1 MVP)
│   ├── DIAGRAMS.md                 # system arch, ERD, sequences, state machines
│   └── DESIGN-SYSTEM.md            # tokens, components, certificate template
└── db/
    ├── migrations/0001–0009*.sql   # the 9 migrations already applied to the live DB
    ├── database.types.ts           # ⚠️ STALE — covers only 0001–0004 (10 tables). Regenerate.
    ├── seed.sql                    # Nail Art Academy org
    └── SUPABASE-SETUP.md           # project ref, keys, env, bootstrap SQL
```

The route handlers are specified by **RFC-001 (video) and RFC-003 (certificates)**; isolation rules by **RFC-002**. When implementing a handler, open the relevant RFC section first — they are detailed enough to build from directly.

---

## Stack

- **Next.js** (App Router, TypeScript) on Vercel — hosts both the admin console and student area.
- **Refine.js** — admin/platform consoles (Supabase data + auth + access-control providers).
- **Student area** — custom Next.js (not Refine): calm, video-hero, mobile-first.
- **Supabase** — Postgres + RLS + Auth + Realtime + Storage (light assets only).
- **Video self-hosted** — Cloudflare R2 (source + HLS) + a **token-authorizing playback proxy** (Cloudflare Worker). No managed video service (no Mux).
- **Workers (Fly.io)** — ffmpeg transcode + `@react-pdf` certificate, fed by **pg-boss** (queue lives inside the same Postgres).
- **UI** — Tailwind + shadcn/ui (Radix). Design tokens in DESIGN-SYSTEM.md — never hardcode a hex.
- **i18n** — Bahasa Indonesia (default) + English.
- **Package manager: bun** (v1.3.11). Use `bun` / `bunx`, not npm/pnpm/yarn.

---

## Supabase (live project)

- **Ref:** `fjfoizybwbsjwzcnuaar` · **URL:** `https://fjfoizybwbsjwzcnuaar.supabase.co` · region ap-southeast-1 · $0/mo.
- **17 tables, all RLS-enabled, security advisors clean.** No further schema migrations needed for the MVP data model.
- **Supabase MCP** is connected in-session (query/inspect the live DB directly).

`.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://fjfoizybwbsjwzcnuaar.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fwDD5GndHv8JTQ-LiiYT6w_8J_iaM_I
SUPABASE_SERVICE_ROLE_KEY=   # paste from dashboard → Project Settings → API. SERVER-ONLY. Never commit.
```

**Regenerate types after any migration** (the committed `database.types.ts` source is stale):
```
bunx supabase gen types typescript --project-id fjfoizybwbsjwzcnuaar > lib/supabase/database.types.ts
```

### DB automation already in place (don't reimplement)
- New `enrolment` → a `course_completion` (`in_progress`) is auto-created.
- A lesson flipping to `completed` → if all **required** lessons are done, the completion auto-moves to `pending_review` (admin then confirms in-app).

### Bootstrap roles after first signups (service-role / SQL editor only)
```sql
select app.set_platform_admin('isfawwaz@gmail.com');
select app.add_member('OWNER_EMAIL@example.com', 'nail-art-academy', 'owner');  -- also 'admin' | 'student'
```
Nail Art Academy org id: `497d249f-6570-4fa3-91df-8de58ac1a1f4`.

### Storage buckets (Supabase, light assets only)
`org-assets` (public, images, 5MB) · `thumbnails` (private, images, 5MB) · `certificates` (private, PDF, 10MB). Video source/HLS lives in **R2**, not here. All writes + private reads go through the **server (service role)**; the client never touches storage directly.

---

## Locked decisions (do not relitigate)

- **Admin-grants access only** — no paid self-serve in MVP. Studio billing = Phase 2.
- **Multi-tenant from day one**; org = tenant; shared schema + RLS isolation.
- **Completion** = required lessons watched (**95%**) + admin confirm → auto verifiable PDF certificate.
- **Assessments are informational** — they do NOT gate completion.
- **Certificates** = snapshot fields (name/course/org frozen at issue) + public `verify_certificate` RPC; verification page is the source of truth, PDF is a keepsake; `CP-XXXX-XXXX` Crockford code; idempotent re-render, one cert per completion, code never changes.
- **Queue** = pg-boss · **transcode worker** = Fly.io · **upload** = Uppy AwsS3 multipart · **storage** = R2 (zero egress).
- **Playback auth** = one short-lived (10–15min) video-scoped JWT per request via a proxy — NOT per-segment presigning.
- **Design** = clean/minimal, neutral slate base, per-org accent, light-only.

---

## Security-critical conventions

1. **Service-role code bypasses RLS — the #1 risk.** Any handler/worker using the service key (transcode callback, cert issuance, signed-URL minting, platform/org creation) MUST re-check org + role + enrolment in app code. Treat the service role as "trusted, therefore dangerous". Keep service-role data access in a thin, audited layer.
2. **The client never supplies a trusted `org_id`.** On writes, the server sets `org_id` from the resolved `[orgSlug]` context; `with check` policies confirm membership.
3. **Storage isolation is code-enforced, not RLS.** R2 keys are org-scoped (`org/{orgId}/videos/{videoId}/...`); keep key derivation centralized so one org can never address another's objects.
4. **Assessment answer key never reaches students.** `assessment_options.is_correct` has no student read policy; the `/assessments/:id` route strips it server-side.
5. **`verify_certificate` is the only deliberate RLS bypass** — a SECURITY DEFINER RPC returning a minimal snapshot projection to anon. Rate-limit it.
6. RLS helper fns (`app.role_in/is_staff/is_member/is_platform_admin`) read **live** membership (not JWT claims) — correctness over speed for MVP.

---

## Build sequence (from BUILD-PLAN.md)

Critical path: **schema/RLS (done) → video pipeline end-to-end → playback auth → everything else.**

- **Phase 0 — Skeleton spike** (current): one org, one course, one lesson — uploaded, single-rendition transcoded, watched through the token proxy, progress tracked, RLS on. *Prove the whole chain before building builder UI.* Epics 0.A repo/tooling → 0.B schema/RLS wiring → 0.C auth → 0.D minimal content → 0.E video pipeline → 0.F playback+progress.
- **Phase 1 — Core MVP**: course builder, full ladder pipeline, students/access, student area, informational assessments, completion + certificates, i18n, RLS isolation test suite.
- **Phase 2 — later**: watermarking/DRM, paid self-serve + studio billing, catalogue, analytics, audit log.

**Still-open inputs (don't block P0):** email provider (Resend vs Postmark — stub invites to console until chosen); certificate branding (owner signature?); source size cap (~5GB assumed).

---

## Commands

```
bun install
bun run dev        # Next.js dev server (Turbopack)
bun run build      # production build
bun run start      # serve production build
bun run lint       # eslint
bunx tsc --noEmit  # typecheck
```

Regenerate DB types after any migration (writes the full 17-table file):
```
bunx supabase gen types typescript --project-id fjfoizybwbsjwzcnuaar > src/lib/supabase/database.types.ts
```
The Supabase MCP `generate_typescript_types` tool does the same without a CLI login when connected in-session.

---

## Project memory

Cross-session memory for this project lives at
`/Users/fawwaz/.claude/projects/-Users-fawwaz-Coding-course-platform/memory/` (index: `MEMORY.md`).
There's also a Cowork-side `Cowork OS v2/Projects/Course Platform/` (CLAUDE.md + memory.md) — separate from this repo.
