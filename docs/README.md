# docs/ — vendored spec mirror (READ-ONLY)

This folder is a **mirror** of the Course Platform planning/design specs, vendored into this repo so a
Claude Code (or any) session is **self-contained** — the agent never depends on the Cowork workspace
being reachable from inside the repo.

> ⚠️ **Do not hand-edit anything in `docs/`.** It is generated. Edit the **canonical source** in Cowork
> (`~/Documents/Cowork OS v2/Outputs/Course Platform/`), then refresh here with `scripts/sync-docs.sh`.

## What's here

| Path | Source of truth for |
|------|---------------------|
| `01_DOCS/PRD.md` | Full product spec (user stories US1–US14, data model §8) |
| `01_DOCS/RFC-001-video-pipeline.md` | Upload, transcode, token-proxy playback, progress |
| `01_DOCS/RFC-002-multitenancy-rls.md` | Tenancy model, RLS helpers, policy patterns |
| `01_DOCS/RFC-003-certificates.md` | Cert codes, snapshots, PDF pipeline, verify RPC |
| `01_DOCS/BUILD-PLAN.md` | Phased, ticket-level build order (P0 spike → P1 MVP) |
| `01_DOCS/DIAGRAMS.md` | System architecture, ERD, sequence + state diagrams |
| `01_DOCS/DESIGN-SYSTEM.md` | Design tokens, components, certificate template |
| `SUPABASE-SETUP.md` | Live project ref, keys, env, bootstrap SQL, migration log |
| `COURSE-PLATFORM-CONTEXT.md` | Portable one-page project brief |

## What was deliberately NOT vendored

The Cowork `db/` folder also holds `migrations/`, `seed.sql`, and a `database.types.ts` snapshot.
Those are **not** mirrored here because the repo already owns the authoritative copies:
- migrations + seed → `supabase/`
- generated types → `src/lib/supabase/database.types.ts` (regenerated from the live DB; the Cowork
  snapshot was stale at 10 tables).

**The database schema's real source of truth is `supabase/migrations/` in this repo**, not any doc.

## Why vendored, not a submodule or sibling clone

Self-contained: CI, teammates, and AI sessions always have the specs with zero setup. The trade-off is
**drift** — refresh after the canonical specs change.

## Refresh

```bash
./scripts/sync-docs.sh
# or point at a moved source:
DOCS_SRC="/path/to/Course Platform" ./scripts/sync-docs.sh
```
