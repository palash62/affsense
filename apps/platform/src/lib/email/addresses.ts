/** Platform sender/recipient addresses for leadvix.io (overridable via env). */
function mailgunFromAddress(): string {
  const raw = process.env.MAILGUN_FROM?.trim();
  if (!raw) return "noreply@mg.leadvix.io";
  const match = raw.match(/<([^>]+)>/);
  return match?.[1]?.trim() || raw;
}

export const PLATFORM_EMAILS = {
  noreply: mailgunFromAddress(),
  support: process.env.SUPPORT_EMAIL?.trim() || "support@leadvix.io",
  admin: process.env.ADMIN_ALERT_EMAIL?.trim() || "admin@leadvix.io",
  fromDisplay:
    process.env.MAILGUN_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    "LeadVix <noreply@mg.leadvix.io>",
} as const;

export function formatSupportFrom(email: string) {
  return `LeadVix <${email.trim()}>`;
}
