# Email Marketing (Native Autoresponder)

Platform-owned email marketing for advertisers — welcome emails, drip sequences, broadcasts, and contact management powered by **Mailgun**.

## Overview

Advertisers can run Mailchimp-style automations without paying for a third-party ESP:

- **Contacts** — auto-synced from captured leads
- **Templates** — HTML emails with merge tags (`{{first_name}}`, `{{campaign_name}}`, etc.)
- **Automations** — multi-step drips on `LEAD_CAPTURED` or `LEAD_APPROVED`
- **Broadcasts** — one-off bulk sends to lists/tags
- **Analytics** — sent, delivered, opens, clicks, bounces, fails
- **Compliance** — unsubscribe links, bounce/complaint suppression

External integrations (Mailchimp, webhook, etc.) remain available under **Advertiser → Integrations**.

## Setup (Admin)

1. Configure Mailgun in the platform `.env` (see below).
2. Go to **Admin → Settings → Email Marketing (Mailgun)** for the webhook URL checklist.
3. In Mailgun, for **each sending domain**, add webhooks pointing to:
   `https://yourapp.com/api/v1/webhooks/mailgun`
   for events: **delivered**, **permanent failure**, **complained**.
4. Set `MAILGUN_WEBHOOK_SIGNING_KEY` from Mailgun → Sending → Webhooks (HTTP webhook signing key).
5. Redeploy the platform image so the webhook route is live.

Environment variables:

```
MAILGUN_API_KEY=
MAILGUN_DOMAIN=mg.yourplatform.com
MAILGUN_FROM=LeadVix <noreply@mg.yourplatform.com>
MAILGUN_API_BASE=https://api.mailgun.net
MAILGUN_WEBHOOK_SIGNING_KEY=
APP_URL=https://yourapp.com
REDIS_URL=redis://localhost:6379
```

### Stats semantics

| Metric | Meaning |
|--------|---------|
| **sent** | Provider accepted (`SENT` or `DELIVERED`) |
| **delivered** | Mailgun `delivered` webhook (`DELIVERED` only) |
| **failed** | Local/provider reject (`FAILED`) |
| **bounced** | Permanent fail / bounce webhook (`BOUNCED`) |
| **opens / clicks** | First-party tracking pixel / link wrap |

Open/click rates use **delivered** when &gt; 0, otherwise **sent**.

Older sends without a real Mailgun message id cannot receive delivery webhooks.

## Running the email worker

Drip delays and retries are processed by a BullMQ worker:

```bash
# Terminal 1
npm run dev

# Terminal 2 (requires Redis)
npm run worker:email
```

Set `REDIS_URL=redis://localhost:6379` in `.env`.

## Advertiser workflow

1. **Email → Templates** — create or use starter templates
2. **Email → Domains** — add domain, publish DNS, Refresh until verified
3. **Email → Automations → Create** — pick trigger, add steps
4. **Activate** — new matching leads receive the sequence
5. **Email → Broadcasts** — send to lists/tags
6. **Email → Settings** — from name, default from email, reply-to

## Merge tags

| Tag | Description |
|-----|-------------|
| `{{first_name}}` | Lead first name |
| `{{last_name}}` | Lead last name |
| `{{email}}` | Contact email |
| `{{phone}}` | Phone |
| `{{campaign_name}}` | Source campaign |
| `{{company_name}}` | Advertiser company / from name |
| `{{unsubscribe_url}}` | One-click unsubscribe link |

## API routes

| Route | Role |
|-------|------|
| `/api/v1/advertiser/email/*` | Templates, automations, contacts, broadcasts, sends, stats, settings |
| `/api/v1/webhooks/mailgun` | Mailgun delivered/bounce/complaint handler |
| `/api/v1/email/track/open\|click` | Engagement tracking |
| `/unsubscribe/[token]` | Public unsubscribe page |

## Module structure

```
src/modules/email-marketing/
├── services/     # contacts, templates, automations, dispatch, send, tracking
├── queue/        # BullMQ enqueue
├── lib/          # template render, tokens
└── index.ts      # public exports
```

Lead events trigger dispatch from `src/services/lead.service.ts`.

## Compliance

- Every marketing email includes `List-Unsubscribe` header + footer link
- Unsubscribed, bounced, and complained contacts are suppressed
- Advertisers must disclose consent on opt-in pages
