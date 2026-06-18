# Library Docs (project-specific usage)

**Order of authority:** real-time docs / MCP → installed `.claude` skills → this file + `docs/` specs →
training knowledge. These libraries move fast; when unsure, check the live source. This file records how
*this project* uses each library — it overrides generic/stale knowledge.

## Next.js 16 (App Router)

- Breaking changes vs older training data — see `AGENTS.md` and `node_modules/next/dist/docs/`.
- `cookies()` and `headers()` are **async** — `await` them. `src/lib/supabase/server.ts` already does.
- Default to Server Components; add `"use client"` only when needed (state, effects, browser APIs,
  Refine providers). Route Handlers live in `route.ts` files; org-scoped pages under `src/app/[orgSlug]/`.
- **Middleware was renamed to `proxy` in Next 16.** The file is `src/proxy.ts`, the exported function is
  `proxy` (not `middleware`), runtime is **nodejs only (no edge)**. Config flags renamed too
  (`skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`). Proxy is for *optimistic* checks + session
  refresh — real authz stays in layouts/handlers. Ours: `src/proxy.ts` → `updateSession` in
  `src/lib/supabase/session.ts`.

## Supabase

- Three clients, never construct ad-hoc ones:
  - `@/lib/supabase/client` — browser (publishable key).
  - `@/lib/supabase/server` — SSR (publishable key, session cookies). Default for RSC + handlers.
  - `@/lib/supabase/service` — service-role, `server-only`, **bypasses RLS** (see invariants).
- All are typed with the generated `Database` from `database.types.ts`.
- The `verify_certificate` RPC lives in the **`app` schema**, so call it as
  `supabase.schema("app").rpc("verify_certificate", { p_code })` (not the default `public`).
- Regenerate types after any migration (`bunx supabase gen types ... > src/lib/supabase/database.types.ts`,
  or the Supabase MCP `generate_typescript_types`).
- Realtime drives live video-status badges in the admin library (RFC-001).

## Refine.js  *(not yet wired — pairs with auth, Epic 0.C)*

- `@refinedev/supabase` data provider wraps a supabase-js client; `@refinedev/nextjs-router` binds
  routing. The `<Refine>` provider tree is a Client Component — it wraps only the admin/platform console
  routes, not the student area or public pages.
- Refine resources map to tables; RLS does the tenant filtering, so resource queries stay simple.
- Auth + access-control providers will gate console routes by membership role.

## Tailwind v4 + shadcn/ui

- **v4 is CSS-first:** theme tokens are CSS variables in `src/app/globals.css` under `@theme inline` +
  `:root`. There is no `tailwind.config.js`. The design-system slate palette is already written there.
- shadcn CLI is **v3**: `bunx shadcn@latest add <component>` (base = Radix). It has no base-*color* flag
  (preset-driven); we set colors by hand to match `docs/01_DOCS/DESIGN-SYSTEM.md`.
- **Never hardcode a hex.** Use token classes: `bg-surface`, `text-foreground`, `text-muted-foreground`,
  `border-border`, `bg-primary text-primary-foreground`, status tokens `bg-success/-warning/-danger/-info`
  (+ `-subtle` / `-foreground` variants). Radius `rounded-md` (8px default), `-lg` (12px modals/cards).
- **Per-org theming:** the `[orgSlug]` layout overrides `--primary` (+ derived `--primary-hover/-active`,
  `--primary-foreground` auto-picked for AA, `--ring`) from `orgs.theme_accent`. Light-only for MVP.
- Components carry icon + text for status (never color alone); full keyboard + visible focus (AA).

## Coming later (per the RFCs — install when you reach that epic)

- **Uppy** (`@uppy/core` + `@uppy/aws-s3`) — resumable multipart upload to R2 (RFC-001 §5).
- **pg-boss** — Postgres-backed job queue for transcode + certificate jobs (RFC-001 §7).
- **hls.js + Vidstack** — the secured player; throttled `timeupdate` → `/api/progress` (RFC-001 §9).
- **@react-pdf/renderer + qrcode** — certificate PDF with embedded QR → `/verify/<code>` (RFC-003 §6).

Append real patterns here as they emerge.
