import { prisma } from "@/lib/prisma";
import {
  validateEmailDeliverability,
  type EmailDeliverabilityResult,
} from "@/lib/email-deliverability";
import { DISPOSABLE_EMAIL_DOMAINS } from "@/modules/fraud/data/disposable-domains";

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

function splitEmail(email: string): { local: string; domain: string } | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;
  return { local: normalized.slice(0, at), domain: normalized.slice(at + 1) };
}

export function isDisposableEmailDomain(email: string): boolean {
  const parts = splitEmail(email);
  return parts ? DISPOSABLE_EMAIL_DOMAINS.has(parts.domain) : false;
}

/** Gmail ignores dots and anything after "+", so a.b+x@gmail.com is ab@gmail.com. */
export function canonicalGmailLocal(email: string): string | null {
  const parts = splitEmail(email);
  if (!parts || !GMAIL_DOMAINS.has(parts.domain)) return null;
  const local = parts.local.split("+")[0]?.replace(/\./g, "") ?? "";
  return local || null;
}

async function hasGmailAliasAccount(email: string): Promise<boolean> {
  const local = canonicalGmailLocal(email);
  if (!local) return false;
  const normalized = email.trim().toLowerCase();

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM users
    WHERE (email LIKE '%@gmail.com' OR email LIKE '%@googlemail.com')
      AND email <> ${normalized}
      AND REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(email, '@', 1), '+', 1), '.', '') = ${local}
    LIMIT 1
  `;
  return rows.length > 0;
}

/** Signup-only email checks layered on top of the shared deliverability check. */
export async function validateSignupEmail(email: string): Promise<EmailDeliverabilityResult> {
  if (isDisposableEmailDomain(email)) {
    return {
      ok: false,
      reason: "Disposable email addresses are not allowed. Use a permanent email address.",
    };
  }

  const deliverability = await validateEmailDeliverability(email);
  if (!deliverability.ok) return deliverability;

  if (await hasGmailAliasAccount(email)) {
    return { ok: false, reason: "An account with this email address already exists." };
  }

  return { ok: true };
}
