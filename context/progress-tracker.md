# Progress Tracker

## Current status

- **Phase:** 0 — Skeleton spike.
- **Last completed:** Epic 0.C merged (PR #1). **Epic 0.E proven end-to-end** on branch
  `feat/video-pipeline-spike`: upload (Uppy multipart) → MinIO → pg-boss → worker ffmpeg 720p HLS +
  poster → callback → `videos.ready` (verified row + MinIO artifacts on a real .mov).
- **Next:** Epic 0.F — token playback proxy + hls.js player + clamped `/progress` (95% completes).

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
- [ ] 0.D Minimal content CRUD.
- [ ] 0.E Video pipeline (single rendition) — uploads/sign, complete+enqueue, Fly worker, callback.
- [ ] 0.F Playback + progress — token issuance, proxy, hls.js player, /progress.

### Phase 1 / 2
- [ ] Not started — see `context/build-plan.md`.

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
