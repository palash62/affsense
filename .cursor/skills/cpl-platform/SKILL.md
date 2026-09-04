---
name: cpl-platform
description: >-
  LeadFlow CPL monorepo — platform (leadvix.io) and tracking (track.leadtb.com)
  apps, Prisma/MySQL, NextAuth, advertiser email module, and local dev workflow.
  Use when working in this repo, adding CPL features, fixing auth/sessions, email
  UI, campaigns/leads/wallet, or when the user mentions CPL, LeadFlow, or leadvix.
---

# CPL Platform

## Quick reference

```bash
npm install
npm run env:local          # localhost .env for all apps
npm run db:push && npm run db:seed
npm run dev:platform       # :3000
npm run dev:tracking       # :3001
npm run build:production   # local prod build; run env:local after if developing
```

## Architecture

| Service | Package | Port | Responsibility |
|---------|---------|------|----------------|
| Platform | `apps/platform` | 3000 | Admin, advertiser, publisher portals, wallet, leads, email autoresponder |
| Tracking | `apps/tracking` | 3001 | Clicks, pixels, postbacks, lead form capture |

Shared MySQL via `@cpl/database` (Prisma). Cross-service leads: tracking proxies to platform internal API with `INTERNAL_SERVICE_TOKEN`.

## Roles and routes

- **Admin** — `app/(admin)/admin/...`
- **Advertiser** — `app/(advertiser)/advertiser/...`
- **Publisher** — `app/(publisher)/publisher/...`

Nav: `apps/platform/src/components/layout/nav-config.ts`.

## Autoresponder module

UI under `/advertiser/email`. Shared shell in `components/advertiser/email/`. Panels are client components; pages stay thin. SMTP settings are **admin only** (`/admin/settings`), not advertiser nav.

## Auth pitfalls (already fixed — preserve)

- Catch invalid JWT in `getSession()` → return `null`
- Login: check action `result.ok` before redirect
- Server pages: guard `session` before rendering protected content
- Never pass Lucide icons from server pages into client panels

## Key docs

- [reference.md](reference.md) — modules, stack, file map
- `docs/PRD.md`, `docs/DESIGN-SYSTEM.md`, `docs/DATABASE-SCHEMA.md`, `docs/SERVICE-ARCHITECTURE.md`

## Guardrails

Follow `.cursor/rules/cpl-*.mdc`. Never deploy to servers or recreate deploy tooling unless explicitly requested.
