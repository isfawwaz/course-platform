# Progress Tracker

## Current status

- **Phase:** 0 — Skeleton spike.
- **Last completed:** Epic 0.A + 0.B core scaffold (Next.js 16 + Supabase clients + design system),
  build green, committed.
- **Next:** Epic 0.C — auth (login + accept-invite), which also unlocks wiring the Refine provider tree.

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
  - [ ] Step 7: `[orgSlug]/layout.tsx` — resolve slug→org, require active membership, apply per-org
    accent CSS vars, minimal authed landing + sign-out in nav.
  - [ ] Step 8: Refine providers (auth/access-control/data) + protected admin placeholder; `sendInvite`
    staff action (still pending — needed to exercise the invite email path).
  - [ ] Step 9: Supabase dashboard config (Site URL, redirect allow-list, email templates for token_hash)
    + full manual smoke (signup → login → magic link → invite → accept).
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
