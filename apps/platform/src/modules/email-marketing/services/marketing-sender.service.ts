import {
  getMailgunConfig,
  isMailgunConfigured,
  sendViaMailgun,
} from "@/lib/email/mailgun";

export type MarketingEmailInput = {
  to: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  listUnsubscribeUrl: string;
};

export type MarketingEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

/**
 * Marketing sends require Mailgun and a real provider message id so delivery
 * webhooks can update EmailSend status. No SMTP fallback and no synthetic ids.
 */
export async function sendMarketingEmail(
  input: MarketingEmailInput,
): Promise<MarketingEmailResult> {
  if (!isMailgunConfigured()) {
    return {
      ok: false,
      error: "Mailgun is not configured. Set MAILGUN_API_KEY and MAILGUN_DOMAIN.",
    };
  }

  const from = `"${input.fromName.replace(/"/g, '\\"')}" <${input.fromEmail}>`;
  const result = await sendViaMailgun({
    to: input.to,
    from,
    subject: input.subject,
    html: input.html,
    text: input.text ?? "",
    replyTo: input.replyTo,
    listUnsubscribeUrl: input.listUnsubscribeUrl,
  });

  if (!result.ok) {
    console.error("[email-marketing] Mailgun error:", result.error);
    return { ok: false, error: result.error };
  }

  const messageId = result.id?.trim();
  if (!messageId || /^(smtp|mailgun|unknown)-/i.test(messageId) || messageId === "unknown") {
    return {
      ok: false,
      error: "Mailgun did not return a message id; delivery webhooks cannot be matched.",
    };
  }

  return { ok: true, messageId };
}

export function buildFromAddress(
  fromName: string,
  fromEmail: string,
): { fromName: string; fromEmail: string } {
  return { fromName, fromEmail };
}

export async function getDefaultFromEmail(): Promise<string> {
  const mailgun = getMailgunConfig();
  if (mailgun) {
    const match = mailgun.from.match(/<([^>]+)>/);
    return match?.[1] ?? mailgun.from;
  }
  return "noreply@mg.leadvix.io";
}

export async function getMarketingProviderName(): Promise<string> {
  if (isMailgunConfigured()) return "mailgun";
  return "none";
}
