<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CPL Agent Context

## Guardrails (`.cursor/rules/`)

| Rule | Scope |
|------|--------|
| `cpl-core.mdc` | Monorepo, local dev, env, no silent deploys |
| `cpl-workflow.mdc` | Feature planning vs direct fixes |
| `cpl-nextjs.mdc` | Next.js 16, RSC, auth (`apps/**`) |
| `cpl-platform-ui.mdc` | Platform UI and email module (`apps/platform/**`) |
| `cpl-docker-standalone.mdc` | Standalone Docker packaging, hashed externals, GHCR `:latest` |

## Project skill

`.cursor/skills/cpl-platform/SKILL.md` — architecture, commands, autoresponder patterns, doc index.

## Docs

`docs/PRD.md`, `docs/DESIGN-SYSTEM.md`, `docs/SERVICE-ARCHITECTURE.md`, `docs/DATABASE-SCHEMA.md`
