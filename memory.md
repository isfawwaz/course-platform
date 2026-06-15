# Session Memory

Read this after `context/`. Update it at the **end** of each session.

## What was built (most recent first)

- **Agent-context set up.** Vendored Cowork specs into `docs/` (read-only mirror + `scripts/sync-docs.sh`);
  authored the `context/` doc set; made `AGENTS.md`/`CLAUDE.md` read-first entry points.
- **Phase 0 scaffold (Epic 0.A + 0.B core).** Next.js 16 + React 19 + Tailwind v4 + shadcn (Radix);
  design-system slate tokens + Inter/JetBrains fonts in `globals.css`; Supabase clients
  (browser/SSR/service-role) + `database.types.ts` for all 17 tables; 9 migrations + seed in `supabase/`;
  `.env.local` (+ `.env.example`). `bun run build` green. Committed as `173ab64`.

## Decisions made

- Stack: Next.js 16 / React 19 / Tailwind v4 (newer than docs assumed) — kept. Pkg manager: **bun**.
- Slate design tokens written by hand (shadcn v3 has no base-color flag). Fonts Inter + JetBrains Mono.
- Types regenerated from live DB (Cowork snapshot was stale at 10 tables).
- Specs vendored into `docs/` for a self-contained repo.

## Problems solved

- create-next-app refused to scaffold with `CLAUDE.md` present → moved it aside, scaffolded, restored,
  and made it import Next 16's generated `AGENTS.md` rules.
- `.env*` gitignore hid `.env.example` → added a `!.env.example` exception.

## Current state

Builds clean; no app routes/handlers yet beyond the placeholder home page. Refine `<Refine>` provider
**not yet wired**. `SUPABASE_SERVICE_ROLE_KEY` still blank in `.env.local`.

## Next session starts with

Epic **0.C — auth** (login email/password + magic link; accept-invite → membership active), then wire
the Refine provider tree. See `context/progress-tracker.md`.

## Open questions

- Email provider (Resend vs Postmark) — stub invites to console until chosen.
- Certificate branding / owner signature image.
- Source video size cap (~5 GB assumed).
