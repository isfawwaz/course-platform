# Project skills

Vendored from **[JavaScript-Mastery-Pro/skills](https://github.com/JavaScript-Mastery-Pro/skills)**
(`@jsmastery/skills`, MIT — see `LICENSE`). The "JSM Engineering Loop": five slash commands that add
engineering discipline around an AI build.

| Skill | When to use |
|-------|-------------|
| `/architect` | Before building anything — think through it like a senior engineer, produce a plan you confirm |
| `/remember` | End/start of every session — `save` compresses context to memory, `restore` brings it back |
| `/review` | After building a feature — verify plan alignment, system integrity, production readiness |
| `/recover` | When something goes wrong — diagnose targeted-fix vs hard-reset vs rethink |
| `/imprint` | After building a UI component — extract visual patterns to a UI registry for consistency |

> Note: this project already has its own session-memory setup (`memory.md` + `context/` per the
> agent-context config). `/remember` and `/imprint` overlap with those — reconcile rather than run both
> blindly (e.g. point `/imprint`'s registry at the design system in `docs/01_DOCS/DESIGN-SYSTEM.md`).

Update with: `npx skills@latest add JavaScript-Mastery-Pro/skills`, or re-fetch the `SKILL.md` files
from the repo's `skills/<name>/` paths.
