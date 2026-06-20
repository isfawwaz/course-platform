# Progress Tracker

## Current status

- **Phase:** 0 — Skeleton spike.
- **Last completed:** **Phase 0 spike complete** (PR #2, branch `feat/video-pipeline-spike`):
  0.D course builder + 0.E pipeline + 0.F playback/progress, proven end-to-end on a real .mov
  (upload → transcode → token playback → progress → completion `pending_review`). 0.A–0.C merged in PR #1.
- **Next:** merge PR #2, then Phase 1 — Fly.io worker + full ladder/captions (1.B), roster/grant UI (1.C),
  assessments (1.E), completion → certificate + public verify (1.F). Loose ends: RLS isolation test, 0.C Tier-2 invite smoke.

### Spike gotchas (learned)
- pg-boss needs the **Session pooler** (`aws-1-ap-southeast-1.pooler.supabase.com:5432`,
  user `postgres.<ref>`); the direct `db.<ref>.supabase.co:5432` drops the worker's long-lived
  connection. The pooler region prefix is **aws-1**, not aws-0.
- The proxy session gate must exempt service/token-authed API routes (`/api/internal`,
  `/api/playback`) — otherwise the worker callback gets 307'd to /login and fails silently.
- Local everything: worker = `bun run worker` (needs ffmpeg), storage = reused `sms-dev-minio`
  on `localhost:9000`, bucket `sms-local`.

## Checklist (mirrors `context/build-plan.md`)

### Phase 0
- [x] 0.A Repo & tooling — Next.js 16 + TS + Tailwind v4 + shadcn (Radix) scaffolded; bun.
- [~] 0.A Refine providers — deps installed; `<Refine>` data/auth/access-control tree **not yet wired**
  (deferred to pair with 0.C auth).
- [x] 0.B Schema & RLS core — 9 migrations + seed in `supabase/`; `database.types.ts` regenerated for all
  17 tables; design-system tokens in `globals.css`; Supabase clients (browser/SSR/service).
- [ ] 0.B `supabase` CLI link to remote (optional; migrations already match).
- [ ] 0.B RLS isolation CI test (two-org matrix).
- [~] 0.C Auth — **in progress** (architect plan confirmed). Decisions: global login + smart redirect;
  Supabase invite + auto-activate; password + magic link via Supabase email.
  - [x] Step 1: session refresh + coarse auth gate — `src/proxy.ts` → `updateSession`
    (`src/lib/supabase/session.ts`). Verified (protected 307→/login, public 200).
  - [x] Step 2: auth callback routes — `/auth/callback` (PKCE code) + `/auth/confirm` (token_hash OTP),
    both → safe `next` or landing. Verified error redirects.
  - [x] Step 3: landing resolver — `src/lib/auth/landing.ts` (`resolveLanding`) +
    `src/lib/auth/redirects.ts` (`safeNext`, `redirectBase`).
  - [x] Step 4: public pages — `(auth)` layout + /login (password + magic-link tabs) + /signup; server
    actions in `src/lib/auth/actions.ts`; shadcn button/input/label/card/tabs/sonner (sonner de-themed,
    light-only). Render + routing verified. Real sign-in pending Supabase dashboard config.
  - [x] Step 5: /accept-invite — auto-activates caller's invited memberships
    (`src/lib/auth/memberships.ts`, service-role scoped to uid) + optional set-password (`setPassword`
    action). Verified unauth redirect.
  - [x] Step 6: /select-org (picker) + /no-access (with sign-out) under `(account)` layout; `logout`
    action wired. Verified both gated by proxy.
  - [x] Step 7: `[orgSlug]/layout.tsx` — org+membership resolved in one RLS query (`orgs_member_read`),
    non-members bounce to landing; per-org accent via `src/lib/theme/accent.ts` (AA foreground,
    8%/16% darken, 45% ring); header with org name/role/sign-out; minimal `[orgSlug]/page.tsx` dashboard.
    Verified accent math (#E11D48) + unauth gate.
  - [x] Step 8: Refine wired — `RefineProvider` (data via RLS browser client, router
    `@refinedev/nextjs-router/app`, auth + access-control) mounted in staff-gated
    `[orgSlug]/admin/layout.tsx`; placeholder admin page + working invite form; `sendInvite` action
    (`src/lib/auth/invites.ts`, staff re-checked, service-role invite + invited membership). Resources
    empty until 0.D. Verified build + unauth gate.
  - [~] Step 9: live smoke. **Tier 1 PASSED** against the live backend (2026-06-18): signup → password
    login (303 via resolveLanding) → /nail-art-academy 200 (org-layout active-membership authz) →
    per-org rose theming (`#E11D48` primary) → staff-gated /admin with Refine mounted. Bootstrap run via
    MCP (isfawwaz@gmail.com = platform admin + nail-art-academy owner). Fixed: signup confirm email now
    targets `/auth/callback` (PKCE code) to match Supabase's default template — earlier `/auth/confirm`
    caused "sign-in link incomplete". **Tier 2 (invite send + accept) pending** — needs service-role key
    in .env.local + invite email template → /auth/confirm?type=invite. Magic-link round-trip not yet
    smoke-tested (uses /auth/callback, default template).
- [x] 0.D Minimal content CRUD — server-action builder (`src/lib/content/actions.ts`):
  create course (admin home) + add module/lesson with ready-video attach + required toggle
  (`/[orgSlug]/admin/courses/[courseId]`). Verified live (added Lesson #1 w/ video). Full
  reorder/publish-guard = 1.A. KNOWN LIMITATION: `refresh_completion` fires only on progress writes,
  so adding a required lesson after a completion is confirmed doesn't re-open it (Phase 1 lifecycle).
- [x] 0.E Video pipeline (single rendition) — Uppy multipart upload routes, complete+enqueue (pg-boss),
  local worker (ffmpeg 720p HLS + poster), transcode callback, polling status badge. **Proven live.**
  (Fly.io worker deploy + full ladder = P1.)
- [x] 0.F Playback + progress — playback-token route, token proxy (`/api/playback`), hls.js player,
  clamped `/progress` → 95% completes. **Proven live.**

**Phase 0 spike DoD MET (2026-06-18):** a seeded student watched a real transcoded lesson through the
token proxy; clamped progress persisted and completed; the completion auto-flipped to `pending_review`;
no cross-org read. Branch `feat/video-pipeline-spike` (commits through e63de01).

Remaining Phase 0 loose ends (low priority): 0.A Refine wiring is done; 0.C Tier-2 invite smoke; 0.D
real content builder UI; RLS isolation CI test.

### Phase 1 / 2
- [x] **1.F Completion → certificate + public verify** — built on `feat/certificates`, build/lint/tsc
  green. Migration `0010` applied live + types regenerated. PR #3 review-complete (all 12 CodeRabbit
  findings addressed). **Live issuance smoke PASSED (2026-06-20):** confirmed completion → worker rendered
  PDF (7117 B) → Supabase Storage `certificates` bucket → `pdf_key` stamped → service-signed download
  returned a valid `%PDF-` → `public.verify_certificate` RPC + public `/verify/<code>` page showed
  "Certificate verified" (cert `CP-FF8E-BCG1`, course "Nail Art Basics", isfawwaz). not-found + malformed
  (`%`→HTTP 400, no 500) cases also verified.
  - [x] Risk-first spike: `@react-pdf/renderer` + `qrcode` render a valid PDF under the bun worker.
  - [x] Crockford code gen (`CP-XXXX-XXXX`) + look-alike-tolerant normalizer (`src/lib/certificates/code.ts`).
  - [x] Confirm/reject handlers (`/api/completions/:id/{confirm,reject}`) — staff re-checked, RLS client;
    confirm transitions `pending_review→confirmed`, issues cert row (snapshots+code, one-per-completion),
    enqueues `certificate.issue`. Issuance uses the RLS client (staff policies cover it) — service role
    reserved for the worker.
  - [x] Admin pending-review queue (`[orgSlug]/admin/completions`) + confirm/reject actions.
  - [x] Certificate worker (`worker/certificate.ts` + `certificate-template.tsx`): renders branded PDF
    (id/en) + QR → **Supabase Storage** `certificates` bucket (`org/{orgId}/certificates/{id}.pdf`) via a
    worker-local service client (NOT the `server-only` app client), sets `pdf_key`. Idempotent (upsert).
    Email stubbed. New pg-boss `certificate` queue in `src/lib/queue/boss.ts`.
  - [x] Signed download (`/api/certificates/:id/download` → service-minted signed URL after RLS check) +
    student "My certificates" (`[orgSlug]/certificates`).
  - [x] Public `/verify/[code]` (typed RPC) + revoke (`/api/certificates/:id/revoke` + admin certs list).
  - [x] **Migration `0010_public_verify_wrapper.sql` APPLIED LIVE:** `public.verify_certificate` delegates
    to the `app.` one (the `app` schema is unreachable — PostgREST exposes only public/graphql_public).
    Verified anon-reachable (HTTP 200). `database.types.ts` regenerated (now has the `verify_certificate`
    Function).
  - Font note: template uses built-in Helvetica (Latin-1, fine for Indonesian); embed Inter/Noto when the
    branding design lands (RFC-003 §13, still open). Cert branding + owner signature = open design input.

## Decisions made during build

- Stack came in newer than docs assumed: **Next.js 16 + React 19 + Tailwind v4** (kept, not downgraded).
- **bun** chosen as package manager.
- shadcn v3 CLI has no base-color flag → design-system slate tokens written by hand in `globals.css`.
- Fonts: **Inter** (UI, latin+latin-ext for Indonesian) + **JetBrains Mono** (codes), replacing Geist.
- Types regenerated from the **live DB** (the Cowork `db/database.types.ts` snapshot was stale at 10
  tables); 17-table version lives in `src/lib/supabase/database.types.ts`.
- Specs **vendored** into `docs/` (read-only mirror) so the repo is self-contained; refresh via
  `scripts/sync-docs.sh`.

## Notes

- `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` is still blank — paste before building upload/playback/cert
  handlers (Epics 0.E/0.F/1.F).
- Bootstrap roles (`set_platform_admin` / `add_member`) run **after** the first real signups (0.C).
