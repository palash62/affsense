import { PLATFORM_EMAILS } from "@/lib/email/addresses";

export type MailgunSendInput = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  listUnsubscribeUrl?: string;
  /** Mailgun API domain path; defaults from From host or platform MAILGUN_DOMAIN */
  mailingDomain?: string;
};

export type MailgunConfig = {
  apiKey: string;
  domain: string;
  apiBase: string;
  from: string;
};

export type MailgunDnsRecordRaw = {
  record_type?: string;
  name?: string;
  value?: string;
  valid?: string;
  priority?: string | number;
};

export type MailgunDomainDetails = {
  name: string;
  state: string;
  sendingDnsRecords: MailgunDnsRecordRaw[];
  receivingDnsRecords: MailgunDnsRecordRaw[];
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

function mailgunAuthHeader(apiKey: string) {
  return `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`;
}

async function mailgunRequest<T>(
  config: MailgunConfig,
  method: string,
  path: string,
  body?: URLSearchParams,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const url = `${config.apiBase}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: mailgunAuthHeader(config.apiKey),
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: body?.toString(),
    });
    const raw = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      parsed = { message: raw };
    }
    if (!res.ok) {
      const message =
        (typeof parsed.message === "string" && parsed.message) ||
        (typeof parsed.error === "string" && parsed.error) ||
        `Mailgun HTTP ${res.status}`;
      return { ok: false, status: res.status, error: message };
    }
    return { ok: true, data: parsed as T };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Mailgun request failed",
    };
  }
}

function mapDomainPayload(parsed: Record<string, unknown>, fallbackName: string): MailgunDomainDetails {
  const domainObj =
    parsed.domain && typeof parsed.domain === "object"
      ? (parsed.domain as Record<string, unknown>)
      : parsed;
  const name =
    (typeof domainObj.name === "string" && domainObj.name) ||
    (typeof parsed.name === "string" && parsed.name) ||
    fallbackName;
  const state =
    (typeof domainObj.state === "string" && domainObj.state) ||
    (typeof parsed.state === "string" && parsed.state) ||
    "unverified";
  const sendingDnsRecords = Array.isArray(parsed.sending_dns_records)
    ? (parsed.sending_dns_records as MailgunDnsRecordRaw[])
    : Array.isArray(domainObj.sending_dns_records)
      ? (domainObj.sending_dns_records as MailgunDnsRecordRaw[])
      : [];
  const receivingDnsRecords = Array.isArray(parsed.receiving_dns_records)
    ? (parsed.receiving_dns_records as MailgunDnsRecordRaw[])
    : Array.isArray(domainObj.receiving_dns_records)
      ? (domainObj.receiving_dns_records as MailgunDnsRecordRaw[])
      : [];
  return { name, state, sendingDnsRecords, receivingDnsRecords };
}

export async function createMailgunDomain(
  name: string,
): Promise<{ ok: true; data: MailgunDomainDetails } | { ok: false; error: string; status?: number }> {
  const config = getMailgunConfig();
  if (!config) return { ok: false, error: "Mailgun is not configured" };

  const body = new URLSearchParams();
  body.set("name", name.trim().toLowerCase());

  const result = await mailgunRequest<Record<string, unknown>>(
    config,
    "POST",
    "/v4/domains",
    body,
  );
  if (!result.ok) {
    // Domain may already exist on the Mailgun account — fetch details
    if (result.status === 400 || result.status === 409) {
      const existing = await getMailgunDomain(name);
      if (existing.ok) return existing;
    }
    return { ok: false, error: result.error, status: result.status };
  }
  return { ok: true, data: mapDomainPayload(result.data, name) };
}

export async function getMailgunDomain(
  name: string,
): Promise<{ ok: true; data: MailgunDomainDetails } | { ok: false; error: string; status?: number }> {
  const config = getMailgunConfig();
  if (!config) return { ok: false, error: "Mailgun is not configured" };

  const encoded = encodeURIComponent(name.trim().toLowerCase());
  const result = await mailgunRequest<Record<string, unknown>>(
    config,
    "GET",
    `/v4/domains/${encoded}`,
  );
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  return { ok: true, data: mapDomainPayload(result.data, name) };
}

export async function verifyMailgunDomain(
  name: string,
): Promise<{ ok: true; data: MailgunDomainDetails } | { ok: false; error: string; status?: number }> {
  const config = getMailgunConfig();
  if (!config) return { ok: false, error: "Mailgun is not configured" };

  const encoded = encodeURIComponent(name.trim().toLowerCase());
  const result = await mailgunRequest<Record<string, unknown>>(
    config,
    "PUT",
    `/v4/domains/${encoded}/verify`,
  );
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  return { ok: true, data: mapDomainPayload(result.data, name) };
}

export async function deleteMailgunDomain(
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = getMailgunConfig();
  if (!config) return { ok: false, error: "Mailgun is not configured" };

  const encoded = encodeURIComponent(name.trim().toLowerCase());
  const result = await mailgunRequest<Record<string, unknown>>(
    config,
    "DELETE",
    `/v3/domains/${encoded}`,
  );
  if (!result.ok) {
    // Already gone is fine
    if (result.status === 404) return { ok: true };
    return { ok: false, error: result.error };
  }
  return { ok: true };
}

export function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim().toLowerCase();
}

export function extractEmailDomain(from: string): string | null {
  const email = extractEmailAddress(from);
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const host = email.slice(at + 1).trim().toLowerCase();
  return host || null;
}

function resolveMailingDomain(input: MailgunSendInput, config: MailgunConfig): string {
  if (input.mailingDomain?.trim()) {
    return input.mailingDomain.trim().toLowerCase();
  }
  const host = extractEmailDomain(input.from);
  if (host && host !== config.domain.toLowerCase()) {
    return host;
  }
  return config.domain;
}

export async function sendViaMailgun(
  input: MailgunSendInput,
): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const config = getMailgunConfig();
  if (!config) {
    return { ok: false, error: "Mailgun is not configured" };
  }

  const mailingDomain = resolveMailingDomain(input, config);

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

  const url = `${config.apiBase}/v3/${encodeURIComponent(mailingDomain)}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: mailgunAuthHeader(config.apiKey),
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
