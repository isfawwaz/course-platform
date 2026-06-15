# Course Platform — Project Context (read first)

Multi-tenant video LMS (studios upload video courses; students earn verifiable certificates).
First client: Nail Art Academy. The Supabase backend is **already built and live**; this repo is the
application code. Package manager is **bun**.

Before any project work, read these in order:
1. `context/project-overview.md` — what this is, users, scope, non-negotiable principles
2. `context/architecture.md` — stack, layout, layer boundaries, data flow, **invariants (never violate)**
3. `context/code-standards.md` — engineering rules + patterns
4. `context/build-plan.md` — build order (cites the specs) · `context/progress-tracker.md` — status
5. `context/library-docs.md` — project-specific library usage (Supabase/Refine/Tailwind/Next)
6. `memory.md` — what changed last session; **update it at session end**

**Requirements & schema:** the authoritative specs are vendored read-only into `docs/` (see
`docs/README.md`) — PRD + RFC-001/002/003 + design + diagrams in `docs/01_DOCS/`, plus
`docs/SUPABASE-SETUP.md`. Cite the spec when building; **never invent schema** — the real source of truth
is `supabase/migrations/` and `src/lib/supabase/database.types.ts` (the docs are mirrors).

**Security is structural.** Read the invariants in `context/architecture.md` before writing any Route
Handler — especially: the service-role client (`src/lib/supabase/service.ts`) bypasses RLS, so re-check
org + role + enrolment in code.

**Order of authority for APIs:** real-time docs / MCP (Supabase MCP, `node_modules/next/dist/docs/`) →
installed `.claude` skills → `context/` + `docs/` specs → training knowledge. (Framework APIs drift;
check the live source first.)

The tool-managed guidelines below remain in force.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
