import { PLATFORM_EMAILS } from "@/lib/email/addresses";

export type MailgunSendInput = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  listUnsubscribeUrl?: string;
};

export type MailgunConfig = {
  apiKey: string;
  domain: string;
  apiBase: string;
  from: string;
};

export function getMailgunConfig(): MailgunConfig | null {
  const apiKey = process.env.MAILGUN_API_KEY?.trim();
  const domain = process.env.MAILGUN_DOMAIN?.trim();
  if (!apiKey || !domain) return null;

  const apiBase = (process.env.MAILGUN_API_BASE?.trim() || "https://api.mailgun.net").replace(
    /\/$/,
    "",
  );
  const from =
    process.env.MAILGUN_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    PLATFORM_EMAILS.fromDisplay;

  return { apiKey, domain, apiBase, from };
}

export function isMailgunConfigured(): boolean {
  return getMailgunConfig() !== null;
}

export async function sendViaMailgun(
  input: MailgunSendInput,
): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const config = getMailgunConfig();
  if (!config) {
    return { ok: false, error: "Mailgun is not configured" };
  }

  const body = new URLSearchParams();
  body.set("from", input.from);
  body.set("to", input.to);
  body.set("subject", input.subject);
  body.set("html", input.html);
  body.set("text", input.text);
  if (input.replyTo?.trim()) {
    body.set("h:Reply-To", input.replyTo.trim());
  }
  if (input.listUnsubscribeUrl) {
    body.set("h:List-Unsubscribe", `<${input.listUnsubscribeUrl}>`);
    body.set("h:List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
  }

  const auth = Buffer.from(`api:${config.apiKey}`).toString("base64");
  const url = `${config.apiBase}/v3/${encodeURIComponent(config.domain)}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const raw = await res.text();
    let parsed: { message?: string; id?: string } = {};
    try {
      parsed = raw ? (JSON.parse(raw) as { message?: string; id?: string }) : {};
    } catch {
      parsed = { message: raw };
    }

    if (!res.ok) {
      return {
        ok: false,
        error: parsed.message || `Mailgun HTTP ${res.status}`,
      };
    }

    return { ok: true, id: parsed.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Mailgun request failed",
    };
  }
}
