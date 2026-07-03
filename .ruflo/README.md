# Ruflo Integration

This directory contains configuration for the Ruflo harness used exclusively for development and tooling within the Doxnira Fiscal project. It is **not** part of the production runtime and is ignored by the application.

- Do not commit any runtime credentials or secrets here.
- The harness is configured locally with `npx ruflo@latest init wizard` and used on demand.
- OpenCode is the primary executor, guided by `docs/agents/AGENTS.md` and the checklists in `docs/`.
- All agents defined in `docs/agents/AGENTS.md` operate under this harness.
