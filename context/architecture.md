# Architecture

## Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Framework | **Next.js 16** (App Router, TS, Turbopack) + **React 19** | App + Route Handlers, RSC |
| Admin/platform UI | **Refine.js** (`@refinedev/core` v5, `nextjs-router` v7, `supabase` v6) | Data-dense consoles (data/auth/access-control providers) — *not yet wired* |
| Student UI | Custom Next.js | Calm, video-hero, mobile-first (no Refine) |
| Styling | **Tailwind v4** + **shadcn/ui** (Radix) | Tokenized design system (`src/app/globals.css`) |
| Backend | **Supabase** | Postgres + RLS + Auth + Realtime + Storage (light assets) |
| Video storage | **Cloudflare R2** | Source + HLS renditions (zero egress) |
| Playback auth | **Token-authorizing proxy** (Cloudflare Worker) | One short-lived video-scoped JWT per request |
| Queue | **pg-boss** (inside the same Postgres) | Transcode + certificate jobs |
| Workers | **Fly.io** | ffmpeg transcode worker · `@react-pdf` certificate worker |
| Fonts | Inter (UI) · JetBrains Mono (codes/IDs) | Inter covers Latin + Indonesian diacritics |
| Pkg manager | **bun** (v1.3.x) | Use `bun`/`bunx`, not npm/pnpm/yarn |

## Folder structure

```
src/
  app/                      # Next.js App Router (pages, layouts, route handlers)
    globals.css             # design-system tokens (slate base, per-org accent, light-only)
    layout.tsx              # root layout, Inter + JetBrains Mono
  lib/
    supabase/
      client.ts             # browser client (publishable key, RLS-enforced)
      server.ts             # SSR client (publishable key, async cookies)
      service.ts            # SERVICE-ROLE client (bypasses RLS — server-only)
      database.types.ts     # generated types for all 17 tables
    utils.ts                # shadcn cn() helper
supabase/
  migrations/               # 0001–0009 — REAL source of truth for the schema
  seed.sql                  # Nail Art Academy org
docs/                       # vendored read-only spec mirror (see docs/README.md)
context/                    # this agent-context set
scripts/sync-docs.sh        # refresh docs/ from Cowork
```

Planned (not yet created): `src/app/[orgSlug]/...` (org-scoped routes), Route Handlers under
`src/app/api/...`, and `workers/` for the Fly.io transcode + certificate processes.

## System boundaries — what each layer owns

- **Refine (admin)** talks to Postgres through its Supabase **data provider** for ordinary CRUD; RLS
  enforces tenant isolation on every query.
- **Route Handlers** own everything RLS can't: signed uploads, transcode enqueue/callback, playback
  token issuance, completion confirmation, certificate issuance, signed downloads, org creation.
- **Postgres + RLS** is the last line of defence — even a buggy handler must not leak cross-org data.
- **R2 + playback proxy** hold video; isolation is **code-enforced** via org-scoped keys + signed access.
- **Supabase Storage** holds only light assets (thumbnails, certificate PDFs, org logos).

## Request / data flow (the spike chain)

Upload → `POST /api/uploads/sign` (presign R2 multipart) → client PUTs parts → `POST /api/videos/:id/complete`
(finalize + enqueue pg-boss) → Fly transcode worker (ffmpeg → HLS) → `POST /api/internal/transcode-callback`
(mark `ready`) → student opens lesson → `GET /api/lessons/:id/playback` (enrolment check → token) →
playback proxy streams R2 → `POST /api/progress` (clamped; 95% → lesson completed → completion
`pending_review`) → admin confirms → certificate issued (snapshots + code) → public `/verify/[code]`.
Full sequences: `docs/01_DOCS/DIAGRAMS.md`.

## Cross-cutting: the Supabase backend

- **Live project:** ref `fjfoizybwbsjwzcnuaar`, URL `https://fjfoizybwbsjwzcnuaar.supabase.co`,
  region ap-southeast-1. **17 tables, all RLS-enabled, advisors clean.** No further schema migrations
  needed for the MVP data model.
- **Env** (`.env.local`, see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (client-safe), `SUPABASE_SERVICE_ROLE_KEY` (server-only, paste
  from dashboard → Project Settings → API; never commit).
- **DB automation already in place — do not reimplement:** new enrolment auto-creates a
  `course_completion` (`in_progress`); when all *required* lessons are `completed` the completion
  auto-moves to `pending_review`.
- **RLS helpers** live in the `app` schema: `app.role_in(org)`, `app.is_staff(org)`, `app.is_member(org)`,
  `app.is_platform_admin()`, `app.is_enrolled(...)`. Public `app.verify_certificate(code)` RPC is the
  one deliberate RLS bypass (returns a minimal snapshot projection to anon).
- **Bootstrap roles after first signups** (service-role / SQL editor only):
  `select app.set_platform_admin('isfawwaz@gmail.com');` then
  `select app.add_member('OWNER_EMAIL','nail-art-academy','owner');`. Nail Art Academy org id
  `497d249f-6570-4fa3-91df-8de58ac1a1f4`.
- **Storage buckets** (Supabase): `org-assets` (public, images) · `thumbnails` (private) ·
  `certificates` (private, PDF). All writes + private reads go through the server (service role); the
  client never touches storage directly. Video source/HLS lives in **R2**, not here.

## Invariants (never violate)

1. **Service-role code bypasses RLS — the #1 risk.** Any handler/worker using `service.ts` MUST
   re-check org + role + enrolment in app code. Treat the service role as "trusted, therefore
   dangerous." Keep service-role data access in a thin, audited layer.
2. **The client never supplies a trusted `org_id`.** The server sets `org_id` from the resolved
   `[orgSlug]` context; `with check` policies confirm membership.
3. **Storage isolation is code-enforced.** R2 keys are org-scoped (`org/{orgId}/videos/{videoId}/...`);
   keep key derivation centralized so one org can never address another's objects.
4. **`assessment_options.is_correct` never reaches students.** No student RLS read policy; the
   `/assessments/:id` route strips it server-side.
5. **Certificates use snapshot fields**, never live joins — an issued cert is immutable. One cert per
   completion; the code never changes on re-issue.
6. **Playback = one short-lived (10–15 min) video-scoped JWT per request via the proxy** — never
   per-segment presigning, never a permanent public URL.
7. **Never hardcode a hex** in components — reference a design token (`context/library-docs.md`).

## Where the schema lives

**`supabase/migrations/` is the real source of truth.** `src/lib/supabase/database.types.ts` is
generated from the live DB (regenerate after any migration). `docs/01_DOCS/PRD.md §8` and
`docs/SUPABASE-SETUP.md` describe it but are mirrors — the migrations win.
