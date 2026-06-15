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
- [ ] 0.C Auth — login (email/password + magic link); accept-invite → membership active.
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
