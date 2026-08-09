import { createHmac, timingSafeEqual } from "node:crypto";
import { recordProviderEvent, suppressContact } from "@/modules/email-marketing";
import { normalizeMailgunMessageId } from "@/lib/email/mailgun";

const MAX_SKEW_SECONDS = 15 * 60;

function getSigningKey(): string | null {
  const key = process.env.MAILGUN_WEBHOOK_SIGNING_KEY?.trim();
  return key || null;
}

function verifyMailgunSignature(
  timestamp: string,
  token: string,
  signature: string,
  signingKey: string,
): boolean {
  if (!timestamp || !token || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_SKEW_SECONDS) return false;

  const digest = createHmac("sha256", signingKey)
    .update(timestamp + token)
    .digest("hex");

  try {
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function parseBody(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>;
    // Mailgun “new” webhooks wrap fields under signature / event-data
    const signature = (json.signature ?? {}) as Record<string, unknown>;
    const eventData = (json["event-data"] ?? json) as Record<string, unknown>;
    const message = (eventData.message ?? {}) as Record<string, unknown>;
    const headers = (message.headers ?? {}) as Record<string, unknown>;
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      if (typeof v === "string") flat[k] = v;
    }
    if (typeof signature.timestamp === "string" || typeof signature.timestamp === "number") {
      flat.timestamp = String(signature.timestamp);
    }
    if (typeof signature.token === "string") flat.token = signature.token;
    if (typeof signature.signature === "string") flat.signature = signature.signature;
    if (typeof eventData.event === "string") flat.event = eventData.event;
    if (typeof eventData.recipient === "string") flat.recipient = eventData.recipient;
    const messageId =
      (typeof headers["message-id"] === "string" && headers["message-id"]) ||
      (typeof headers["Message-Id"] === "string" && headers["Message-Id"]) ||
      (typeof (message as { headers?: Record<string, string> }).headers?.["message-id"] ===
        "string" &&
        (message as { headers: Record<string, string> }).headers["message-id"]) ||
      "";
    if (messageId) {
      flat["Message-Id"] = messageId;
      flat["message-id"] = messageId;
    }
    const severity = (eventData as { severity?: string }).severity;
    if (typeof severity === "string") flat.severity = severity;
    return flat;
  }

  const form = await request.formData();
  const flat: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") flat[key] = value;
  });
  return flat;
}

function extractMessageId(fields: Record<string, string>): string | null {
  const raw =
    fields["Message-Id"] ||
    fields["message-id"] ||
    fields["message_id"] ||
    fields["MessageId"] ||
    "";
  return normalizeMailgunMessageId(raw) ?? null;
}

export async function POST(request: Request) {
  try {
    const signingKey = getSigningKey();
    if (!signingKey) {
      console.error("[mailgun-webhook] MAILGUN_WEBHOOK_SIGNING_KEY is not set");
      return Response.json({ ok: false, error: "Webhook not configured" }, { status: 503 });
    }

    const fields = await parseBody(request);
    const timestamp = fields.timestamp ?? "";
    const token = fields.token ?? "";
    const signature = fields.signature ?? "";

    if (!verifyMailgunSignature(timestamp, token, signature, signingKey)) {
      return Response.json({ ok: false }, { status: 403 });
    }

    const event = (fields.event || fields["event"] || "").toLowerCase();
    const messageId = extractMessageId(fields);
    const recipient = (fields.recipient || fields["To"] || "").trim().toLowerCase();
    const severity = (fields.severity || "").toLowerCase();

    if (event === "delivered" && messageId) {
      await recordProviderEvent(messageId, "DELIVERY", { provider: "mailgun" });
    }

    const isPermanentFail =
      event === "permanent_fail" ||
      event === "bounce" ||
      (event === "failed" && severity === "permanent");

    if (isPermanentFail) {
      if (messageId) {
        await recordProviderEvent(messageId, "BOUNCE", {
          provider: "mailgun",
          event,
          severity: severity || undefined,
          recipient: recipient || undefined,
        });
      }
      if (recipient) await suppressContact(recipient, "BOUNCED");
    }

    if (event === "complained") {
      if (messageId) {
        await recordProviderEvent(messageId, "COMPLAINT", {
          provider: "mailgun",
          recipient: recipient || undefined,
        });
      }
      if (recipient) await suppressContact(recipient, "COMPLAINED");
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[mailgun-webhook]", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
