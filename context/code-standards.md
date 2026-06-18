# Code Standards

## Engineering mindset

- Build in **dependency order**, one testable step at a time (see `context/build-plan.md`). The Phase 0
  video spike must work end-to-end before builder UI is invested in.
- Security is structural, not bolted on: respect the invariants in `context/architecture.md` on every
  handler. When a feature touches video, enrolment, or certificates, open the relevant RFC first.
- Prefer server-side enforcement. If a check matters, it lives where the client can't bypass it.

## Language / framework rules

- **TypeScript strict.** No `any` on public boundaries; type Supabase calls via the generated
  `Database` type (`createClient<Database>` is already wired in `src/lib/supabase/`).
- **Next.js 16 / React 19.** APIs drift from older training data — read `AGENTS.md` and
  `node_modules/next/dist/docs/` before writing framework code. Notably: `cookies()`/`headers()` are
  **async**; default to Server Components, mark Client Components with `"use client"`.
- **Server vs client boundary.** Anything using `SUPABASE_SERVICE_ROLE_KEY` imports from
  `src/lib/supabase/service.ts` (marked `server-only`). Never import it into a Client Component.
- **Formatting:** the repo's ESLint (`bun run lint`) + default Prettier-style conventions. 2-space
  indent, double quotes, semicolons (match existing files).
- **String enums as DB strings.** Status columns are plain `text` in Postgres (e.g. video
  `uploading|processing|ready|failed`, completion `in_progress|pending_review|confirmed|rejected`).
  Mirror them as TS string-literal unions; validate at the boundary.

## File & naming

- Routes/segments: lowercase, App Router conventions (`src/app/[orgSlug]/...`, `route.ts` handlers).
- Components: `PascalCase.tsx`. Hooks: `useThing.ts`. Libs/utilities: `kebab-or-camel.ts` matching
  neighbours. shadcn components land in `src/components/ui/`.
- Supabase access goes through `src/lib/supabase/{client,server,service}.ts` — don't construct ad-hoc
  clients.

## Key patterns

- **Reading data in a Server Component / Route Handler** (RLS-enforced):
  ```ts
  import { createClient } from "@/lib/supabase/server";
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").select("*");
  ```
- **Service-role operation** (RLS bypass — re-check authz in code first):
  ```ts
  import { createServiceClient } from "@/lib/supabase/service";
  // 1. verify caller's session + org + role/enrolment yourself
  // 2. only then:
  const admin = createServiceClient();
  ```
- **Setting `org_id` on writes:** resolve it from the `[orgSlug]` route context server-side; never trust
  a client-supplied `org_id`.

## Error handling

- Route Handlers return typed JSON with correct status codes (401 unauthenticated, 403 wrong
  role/no enrolment, 404 not found, 422 validation). Never leak another tenant's data in an error.
- Validate request bodies at the boundary (zod or explicit checks) before any DB/storage call.
- Background workers: jobs must be **idempotent** (re-runnable) — keyed by `videoId` / `certificateId`.

## Testing

- **RLS isolation suite is mandatory and grows with each new table** (RFC-002 §10): two orgs A/B, assert
  no cross-org reads, no reading un-enrolled courses, `is_correct` never exposed, forged `org_id`
  rejected by `with check`. Don't bolt it on at the end.
- Verify the Phase 0 spike by actually watching a transcoded lesson through the proxy (build plan DoD).
- Run `bunx tsc --noEmit` and `bun run build` before declaring a change done.

## Env / config

- Secrets only in `.env.local` (gitignored); `.env.example` documents the keys. Service-role key is
  server-only. Public config uses the `NEXT_PUBLIC_` prefix.

## Dependencies

Approved baseline: Next 16, React 19, Tailwind v4, shadcn/ui (Radix), `@supabase/{supabase-js,ssr}`,
`@refinedev/{core,nextjs-router,supabase}`. Coming per the RFCs: Uppy (AwsS3 multipart), pg-boss,
hls.js + Vidstack, `@react-pdf/renderer`, `qrcode`. **Ask before adding anything outside this set.**

## Order of authority for APIs

Real-time docs / MCP (Supabase MCP, `node_modules/next/dist/docs/`) → installed `.claude` skills →
`context/` + `docs/` specs → training knowledge. Framework APIs drift; check the live source first.
