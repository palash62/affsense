# Advertiser Autoresponder Integrations

Connect your email list or automation tool to receive leads from your CPL campaigns automatically.

## Supported providers

| Provider | Use case |
|----------|----------|
| **Custom Webhook** | Zapier, Make, n8n, or your own endpoint |
| **Mailchimp** | Add subscribers to an audience list |
| **AWeber** | Add subscribers to a list (manual access token in v1) |
| **GetResponse** | Add contacts to a campaign |

## Triggers

Each connection chooses when to fire:

- **When lead is submitted** — fires as soon as the lead is captured (pending or approved).
- **When lead is approved** — fires only after the lead is approved and paid.

You can create multiple connections with different triggers (e.g. webhook on submit, Mailchimp on approval).

## Setup

1. Go to **Advertiser → Integrations**.
2. Click **Add integration** and pick your provider.
3. Choose **All campaigns** or limit to a specific campaign.
4. Enter credentials (API keys are stored encrypted).
5. Use **Test** to send a sample payload.

Connections apply to leads on your campaigns — including traffic from publisher Smart Links and leads from your opt-in pages.

## Campaign scope

- **All campaigns** — every lead on any of your campaigns triggers the connection.
- **Specific campaign** — only leads on that campaign are sent.

## Custom Webhook setup

1. In Zapier / Make / n8n, create a **Catch Hook** (or custom webhook) and copy the **HTTPS URL**.
2. On **Advertiser → Integrations**, choose **Custom Webhook** and paste that URL into **Webhook URL** (not an email address).
3. Optionally set a signing secret, pick a trigger and campaign scope, then save.
4. Click **Guidelines** in the form for placeholder help, or leave **Custom JSON body** blank for the default payload.
5. Click **Test** on the connection — your tool should receive a sample JSON payload.

### Default payload

```json
{
  "event": "lead.captured",
  "leadId": "...",
  "email": "user@example.com",
  "firstName": "Jane",
  "phone": "+1...",
  "campaign": { "id": "...", "name": "..." },
  "publisher": { "id": "..." },
  "source": "facebook",
  "subId": "ad-123",
  "submittedAt": "2026-06-30T12:00:00.000Z"
}
```

If you set a signing secret, requests include an `X-CPL-Signature` header (HMAC-SHA256 of the raw body, hex-encoded).

### Custom JSON body (global template)

For destinations that need a different JSON shape, paste a valid JSON template. Use placeholders inside string values:

`{{email}}`, `{{firstName}}`, `{{lastName}}`, `{{phone}}`, `{{country}}`, `{{campaign.id}}`, `{{campaign.name}}`, `{{publisher.id}}`, `{{source}}`, `{{subId}}`, `{{leadId}}`, `{{event}}`, `{{submittedAt}}`

Example:

```json
{
  "formName": "My Opt-in Form",
  "contact": {
    "email": "{{email}}",
    "firstName": "{{firstName}}",
    "lastName": "{{lastName}}",
    "phone": "{{phone}}"
  }
}
```

Leave the template blank to keep the default Affsense payload (recommended for Zapier / Make / n8n).

### Zapier / Make bridge

You can also send the default payload to a Catch Hook, then map fields in Zapier or Make to any third-party API.

## Field mapping

By default, lead form fields `email`, `first_name`, `last_name`, `phone`, and `country` are mapped automatically into the CPL payload (and thus into template placeholders).

## Compliance

You are responsible for obtaining subscriber consent before adding leads to your marketing lists. Ensure your opt-in pages and privacy policies disclose that information may be shared with your email provider.
