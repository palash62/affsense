# CPL Service Architecture

## Services

| Domain | App | Port | Responsibilities |
|---|---|---|---|
| `leadvix.io` | `@cpl/platform` | 3000 | Admin, advertiser, publisher portals, campaigns, leads, wallet, fraud, autoresponder, REST API |
| `track.leadtb.com` | `@cpl/tracking` | 3001 | Click tracking, redirects, tracking links, pixel, postback, conversion API, JS script |

## Shared packages

- `@cpl/database` — Prisma schema and client (shared MySQL)
- `@cpl/shared` — URL builders, env helpers, validation utilities
- `@cpl/tracking-core` — Click logging, pixel recording, geo lookup

## Inter-service communication

Lead submissions from the tracking domain proxy to the platform internal API:

```
Browser → track.leadtb.com/api/v1/leads/submit
       → leadvix.io/api/internal/v1/leads/submit (X-Service-Token)
       → submitLead() with fraud, wallet, autoresponder
```

## Future server split

Deploy `apps/tracking` to a separate EC2 instance, point DNS for `track.leadtb.com` to the new IP, and update env vars. No code restructuring required.
