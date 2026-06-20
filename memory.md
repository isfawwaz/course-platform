# Memory — Course Platform

Last updated: 2026-06-20

Read this after `context/`. Update at the end of each session (`/remember save`).

## What was built
- **Epic 1.F — Certificates: shipped & merged** (PR #3, branch `feat/certificates` → `main`,
  merge commit `05aeb17`). A confirmed completion becomes a tamper-evident, publicly verifiable
  certificate (RFC-003). Verification page — not the PDF — is the source of truth.
  - `src/lib/certificates/code.ts` — Crockford `CP-XXXX-XXXX` gen + look-alike-tolerant normalizer.
  - `src/lib/certificates/issue.ts` — creates cert row (frozen snapshots + code, one-per-completion,
    code-collision retry, idempotent). Runs on the **RLS client** (staff policies cover it).
  - `src/lib/certificates/keys.ts` — `certificatePdfKey()` + `CERTIFICATES_BUCKET`.
  - `src/app/api/completions/[completionId]/{confirm,reject}/route.ts` — staff confirm/reject.
  - `src/app/api/certificates/[certificateId]/{download,revoke}/route.ts` — signed download + revoke.
  - `src/app/[orgSlug]/admin/{completions,certificates}/` — review queue + issued-certs list w/ revoke.
  - `src/app/[orgSlug]/certificates/page.tsx` — student "My certificates".
  - `src/app/verify/[code]/page.tsx` — public verification.
  - `worker/certificate.ts` + `worker/certificate-template.tsx` — pg-boss `certificate` queue worker:
    react-pdf + QR → Supabase Storage; uses a **worker-local** service client (NOT the app's
    `server-only` one). Wired into `worker/index.ts`; new `CERTIFICATE_QUEUE`/`enqueueCertificate`
    in `src/lib/queue/boss.ts`.
  - Migration `0010_public_verify_wrapper.sql` (applied live) + `database.types.ts` regenerated.
- **Live issuance smoke PASSED end-to-end** against the real backend: confirm → worker rendered PDF
  (7117 B) → Supabase Storage `certificates` bucket → `pdf_key` stamped → service-signed download
  (valid `%PDF-`) → verify RPC + public `/verify/<code>` showed "Certificate verified". Demo cert
  `CP-FF8E-BCG1` ("Nail Art Basics", isfawwaz) left in place intentionally for demos.

## Decisions made
- **`app.verify_certificate` is unreachable from supabase-js** — PostgREST only exposes
  `public`/`graphql_public`. Fix: `public.verify_certificate(text)` SECURITY DEFINER wrapper
  delegating to the `app` one (migration 0010). Verify any new `app.`-schema RPC the same way.
- Certificate **issuance/verify/revoke run on the RLS client** (staff policies `cc_update`/
  `cert_insert`/`cert_update`/`profiles_read` authorize staff). The **service role** is reserved
  for the worker (no session) + signed-URL minting — keeping that surface thin (architecture
  invariant #1). The download route re-checks owner-or-staff explicitly before signing.
- Confirm is **all-or-nothing**: detect zero-affected-rows on the `pending_review→confirmed` update
  (→409), and if issuance throws, revert the completion to `pending_review` (no orphaned confirm).
- Cert PDFs go to **Supabase Storage** `certificates` bucket (private, `org/{orgId}/certificates/
  {id}.pdf`), NOT R2/MinIO. Worker needs only `DATABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (no ffmpeg).
- Template uses built-in **Helvetica** (Latin-1, fine for Indonesian); issue date pinned to **UTC**
  for deterministic re-renders. Embedding Inter/Noto deferred to the branding pass.
- New env var `APP_PUBLIC_URL` (verify-URL origin printed in the PDF/QR); worker refuses the
  localhost fallback when `NODE_ENV==='production'`.

## Problems solved
- `import "server-only"` THROWS under the bun worker runtime — the worker must not import
  `src/lib/supabase/service.ts`; it builds its own `@supabase/supabase-js` service client.
- react-pdf's `<Image>` triggers a false `jsx-a11y/alt-text` lint warning (PDF primitive, not DOM) —
  suppressed with an inline eslint-disable.
- Applying migration 0010 to live prod was blocked by the auto-mode classifier until the user
  explicitly authorized it (separate from authoring the migration file).

## Current state
- On `main` (PR #3 merged, `05aeb17`). Build / `tsc --noEmit` / `eslint` all green. Migration 0010 live.
- All 12 CodeRabbit findings on PR #3 addressed (commit `b6a1e71`) and acknowledged by CodeRabbit.
- `.env.local` is fully populated (service key + DATABASE_URL present — the old "blank" note is stale).
- `memory.md` shows as modified in git but is untracked-by-design churn; not part of any PR.

## Next session starts with
- **Phase 1 core MVP, next epics** (see `context/build-plan.md` Phase 1): pick from **1.A** course
  builder (reorder, required toggle, publish guard), **1.B** Fly.io worker + full HLS ladder/captions,
  **1.C** roster/grant-enrolment UI, **1.E** informational assessments. Certificates (1.F) is done.
- Loose ends carried over: RLS isolation CI test (two-org matrix); 0.C Tier-2 invite smoke;
  email provider still stubbed (cert "ready" notification is a `console.log` TODO in `worker/certificate.ts`).

## Open questions
- **Email provider** (Resend vs Postmark) — still open; cert notification stubbed until chosen.
- **Certificate branding / owner signature image** — needs design input (RFC-003 §13); blocks
  embedding a custom font (Inter/Noto) for full diacritic coverage.
- Whether to re-open a confirmed completion when required lessons change afterward (Phase 1 lifecycle;
  `refresh_completion` only fires on progress writes).
