import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  createMailgunDomain,
  deleteMailgunDomain,
  getMailgunDomain,
  isMailgunConfigured,
  type MailgunDnsRecordRaw,
  type MailgunDomainDetails,
  verifyMailgunDomain,
} from "@/lib/email/mailgun";

export type DnsRecord = {
  type: "CNAME" | "TXT" | "MX";
  name: string;
  value: string;
  purpose: "DKIM" | "SPF" | "DMARC" | "TRACKING" | "MX";
  /** Present for Mailgun records when the API reports DNS check status */
  valid?: boolean;
};

type StoredDnsMeta =
  | string[]
  | {
      provider: "ses" | "mailgun";
      tokens?: string[];
      records?: DnsRecord[];
      state?: string;
    };

function asDkimTokens(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((t): t is string => typeof t === "string" && t.length > 0);
  }
  if (value && typeof value === "object") {
    const meta = value as StoredDnsMeta & object;
    if ("tokens" in meta && Array.isArray(meta.tokens)) {
      return meta.tokens.filter((t): t is string => typeof t === "string" && t.length > 0);
    }
  }
  return [];
}

function asStoredMeta(value: unknown): StoredDnsMeta | null {
  if (!value) return null;
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "object") return value as StoredDnsMeta;
  return null;
}

/** Normalize a sending address so the host always matches the verified domain. */
export function normalizeFromEmailForDomain(
  fromEmail: string | null | undefined,
  domain: string,
): string {
  const normalizedDomain = domain.trim().toLowerCase();
  const raw = (fromEmail ?? "").trim().toLowerCase();
  if (!raw) return `noreply@${normalizedDomain}`;

  const at = raw.lastIndexOf("@");
  const local = at < 0 ? raw : raw.slice(0, at);
  const host = at < 0 ? normalizedDomain : raw.slice(at + 1);

  if (host !== normalizedDomain) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Sending email must use @${normalizedDomain}`,
      422,
    );
  }
  if (!local || !/^[a-z0-9._+-]+$/i.test(local)) {
    throw new AppError("VALIDATION_ERROR", "Enter a valid sending email address", 422);
  }
  return `${local}@${normalizedDomain}`;
}

/** Legacy SES DNS hints for identities created before Mailgun-only. */
function buildLegacySesDnsRecords(domain: string, dkimTokens: string[]): DnsRecord[] {
  const dkim: DnsRecord[] = dkimTokens.map((token) => ({
    type: "CNAME" as const,
    name: `${token}._domainkey.${domain}`,
    value: `${token}.dkim.amazonses.com`,
    purpose: "DKIM" as const,
  }));

  return [
    ...dkim,
    {
      type: "TXT",
      name: domain,
      value: "v=spf1 include:amazonses.com ~all",
      purpose: "SPF",
    },
    {
      type: "TXT",
      name: `_dmarc.${domain}`,
      value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
      purpose: "DMARC",
    },
  ];
}

function guessMailgunPurpose(
  record: MailgunDnsRecordRaw,
): DnsRecord["purpose"] {
  const type = (record.record_type ?? "").toUpperCase();
  const name = (record.name ?? "").toLowerCase();
  const value = (record.value ?? "").toLowerCase();

  if (type === "MX") return "MX";
  if (name.includes("_dmarc") || value.includes("v=dmarc1")) return "DMARC";
  // SPF is TXT with v=spf1 (do not treat tracking CNAMEs pointing at mailgun.org as SPF)
  if (value.includes("v=spf1")) return "SPF";
  if (
    name.includes("_domainkey") ||
    value.includes("k=rsa") ||
    (type === "TXT" && value.includes("p="))
  ) {
    return "DKIM";
  }
  if (type === "CNAME") return "TRACKING";
  if (value.includes("include:mailgun.org") || value.includes("include:mailgun.net")) {
    return "SPF";
  }
  return "DKIM";
}

function mailgunRecordValid(rec: MailgunDnsRecordRaw): boolean | undefined {
  if (typeof rec.valid !== "string") return undefined;
  const v = rec.valid.toLowerCase();
  if (v === "valid") return true;
  if (v === "invalid") return false;
  // "unknown" / other — leave unset so callers can fall back to domain state
  return undefined;
}

function mapMailgunDnsRecords(details: MailgunDomainDetails): DnsRecord[] {
  const mapped: DnsRecord[] = [];

  for (const rec of details.sendingDnsRecords) {
    const typeRaw = (rec.record_type ?? "TXT").toUpperCase();
    const type: DnsRecord["type"] =
      typeRaw === "CNAME" ? "CNAME" : typeRaw === "MX" ? "MX" : "TXT";
    const name = rec.name?.trim();
    const value = rec.value?.trim();
    if (!name || !value) continue;
    const valid = mailgunRecordValid(rec);
    mapped.push({
      type,
      name,
      value: rec.priority != null && type === "MX" ? `${rec.priority} ${value}` : value,
      purpose: guessMailgunPurpose(rec),
      ...(valid !== undefined ? { valid } : {}),
    });
  }

  for (const rec of details.receivingDnsRecords) {
    const typeRaw = (rec.record_type ?? "MX").toUpperCase();
    const type: DnsRecord["type"] =
      typeRaw === "CNAME" ? "CNAME" : typeRaw === "MX" ? "MX" : "TXT";
    const name = rec.name?.trim();
    const value = rec.value?.trim();
    if (!name || !value) continue;
    const valid = mailgunRecordValid(rec);
    mapped.push({
      type,
      name,
      value: rec.priority != null && type === "MX" ? `${rec.priority} ${value}` : value,
      purpose: type === "MX" ? "MX" : guessMailgunPurpose(rec),
      ...(valid !== undefined ? { valid } : {}),
    });
  }

  return mapped;
}

/** Prefer Mailgun per-record valid flags; fall back when records are missing or unflagged. */
function purposeRecordsReady(
  records: DnsRecord[],
  purpose: DnsRecord["purpose"],
  fallback: boolean,
): boolean {
  const matching = records.filter((r) => r.purpose === purpose);
  if (matching.length === 0) return fallback;
  const flagged = matching.filter((r) => typeof r.valid === "boolean");
  if (flagged.length === 0) return fallback;
  return flagged.every((r) => r.valid === true);
}

function isMailgunDomainReady(state: string): boolean {
  const s = state.toLowerCase();
  return s === "active" || s === "verified";
}

function mailgunMetaFromDetails(details: MailgunDomainDetails): Prisma.InputJsonValue {
  return {
    provider: "mailgun",
    state: details.state,
    records: mapMailgunDnsRecords(details),
  };
}

export type SerializedMailbox = {
  id: string;
  email: string;
  fromName: string | null;
  isDefault: boolean;
};

type IdentityWithMailboxes = {
  id: string;
  domain: string;
  fromEmail: string;
  fromName: string;
  verificationStatus: string;
  isDefault: boolean;
  dkimTokens: unknown;
  createdAt: Date;
  updatedAt: Date;
  mailboxes?: Array<{
    id: string;
    email: string;
    fromName: string | null;
    isDefault: boolean;
  }>;
};

async function loadIdentityWithMailboxes(id: string) {
  return prisma.advertiserSendingIdentity.findUniqueOrThrow({
    where: { id },
    include: {
      mailboxes: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
    },
  });
}

async function ensureAtLeastOneMailbox(
  identityId: string,
  advertiserId: string,
  email: string,
  fromName: string | null,
) {
  const count = await prisma.advertiserSendingMailbox.count({ where: { identityId } });
  if (count > 0) return;
  await prisma.advertiserSendingMailbox.create({
    data: {
      identityId,
      advertiserId,
      email: email.toLowerCase(),
      fromName,
      isDefault: true,
    },
  });
}

async function syncIdentityFromDefaultMailbox(identityId: string) {
  const def = await prisma.advertiserSendingMailbox.findFirst({
    where: { identityId, isDefault: true },
  });
  if (!def) return;
  await prisma.advertiserSendingIdentity.update({
    where: { id: identityId },
    data: {
      fromEmail: def.email,
      fromName: def.fromName ?? undefined,
    },
  });
}

/** Keep Email Settings From address aligned with a verified/default mailbox. */
async function syncAdvertiserSettingsFromMailbox(
  advertiserId: string,
  email: string,
  fromName: string | null | undefined,
) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  await prisma.advertiserEmailSettings.upsert({
    where: { advertiserId },
    create: {
      advertiserId,
      fromEmail: normalized,
      fromName: fromName ?? undefined,
    },
    update: {
      fromEmail: normalized,
      ...(fromName != null && fromName !== "" ? { fromName } : {}),
    },
  });
}

export function serializeSendingIdentity(identity: IdentityWithMailboxes) {
  const ready = identity.verificationStatus === "VERIFIED";
  const meta = asStoredMeta(identity.dkimTokens);
  let dnsRecords: DnsRecord[] = [];
  let dkimTokens: string[] = [];
  let provider: "ses" | "mailgun" | "unknown" = "unknown";

  if (Array.isArray(meta)) {
    provider = "ses";
    dkimTokens = asDkimTokens(meta);
    dnsRecords = buildLegacySesDnsRecords(identity.domain, dkimTokens);
  } else if (meta && typeof meta === "object" && "provider" in meta) {
    provider = meta.provider === "mailgun" ? "mailgun" : "ses";
    if (provider === "mailgun" && Array.isArray(meta.records)) {
      dnsRecords = meta.records;
    } else {
      dkimTokens = asDkimTokens(meta.tokens ?? []);
      dnsRecords = buildLegacySesDnsRecords(identity.domain, dkimTokens);
    }
  } else {
    dkimTokens = asDkimTokens(identity.dkimTokens);
    dnsRecords = buildLegacySesDnsRecords(identity.domain, dkimTokens);
    provider = dkimTokens.length ? "ses" : "unknown";
  }

  const dkimReady =
    provider === "mailgun" ? purposeRecordsReady(dnsRecords, "DKIM", ready) : ready;
  const spfReady =
    provider === "mailgun" ? purposeRecordsReady(dnsRecords, "SPF", ready) : false;
  const dmarcReady =
    provider === "mailgun" ? purposeRecordsReady(dnsRecords, "DMARC", ready) : false;

  const mailboxes: SerializedMailbox[] =
    identity.mailboxes && identity.mailboxes.length > 0
      ? identity.mailboxes.map((m) => ({
          id: m.id,
          email: m.email,
          fromName: m.fromName,
          isDefault: m.isDefault,
        }))
      : [
          {
            id: `legacy-${identity.id}`,
            email: identity.fromEmail,
            fromName: identity.fromName,
            isDefault: true,
          },
        ];

  const defaultMailbox = mailboxes.find((m) => m.isDefault) ?? mailboxes[0];

  return {
    id: identity.id,
    domain: identity.domain,
    fromEmail: defaultMailbox?.email ?? identity.fromEmail,
    fromName: defaultMailbox?.fromName ?? identity.fromName,
    verificationStatus: identity.verificationStatus,
    isDefault: identity.isDefault,
    dkimTokens,
    provider,
    ready,
    dkimReady,
    spfReady,
    dmarcReady,
    dnsRecords,
    mailboxes,
    createdAt: identity.createdAt.toISOString(),
    updatedAt: identity.updatedAt.toISOString(),
  };
}

export async function listSendingIdentities(advertiserId: string) {
  const rows = await prisma.advertiserSendingIdentity.findMany({
    where: { advertiserId },
    include: {
      mailboxes: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serializeSendingIdentity);
}

/** Verified mailbox for send/settings validation */
export async function findVerifiedSendingMailbox(advertiserId: string, email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return prisma.advertiserSendingMailbox.findFirst({
    where: {
      advertiserId,
      email: normalized,
      identity: { verificationStatus: "VERIFIED" },
    },
    include: {
      identity: { select: { id: true, domain: true, fromName: true, verificationStatus: true } },
    },
  });
}

export async function listVerifiedSendingMailboxes(advertiserId: string) {
  return prisma.advertiserSendingMailbox.findMany({
    where: {
      advertiserId,
      identity: { verificationStatus: "VERIFIED" },
    },
    include: {
      identity: { select: { id: true, domain: true, fromName: true, verificationStatus: true } },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

async function upsertLocalIdentity(
  advertiserId: string,
  normalizedDomain: string,
  fromName: string,
  dkimTokens: Prisma.InputJsonValue,
  verificationStatus: "PENDING" | "VERIFIED" = "PENDING",
  fromEmailInput?: string | null,
) {
  const existing = await prisma.advertiserSendingIdentity.findUnique({
    where: { advertiserId_domain: { advertiserId, domain: normalizedDomain } },
    include: { mailboxes: true },
  });

  const fromEmail =
    fromEmailInput != null && fromEmailInput.trim()
      ? normalizeFromEmailForDomain(fromEmailInput, normalizedDomain)
      : existing?.fromEmail ?? normalizeFromEmailForDomain(null, normalizedDomain);

  let identityId: string;

  if (existing) {
    const mailboxCount = existing.mailboxes.length;
    const row = await prisma.advertiserSendingIdentity.update({
      where: { id: existing.id },
      data: {
        dkimTokens,
        fromName: fromName || existing.fromName,
        verificationStatus,
        // Only overwrite identity.fromEmail when no mailboxes yet / intentional first email
        ...(mailboxCount === 0 || (fromEmailInput?.trim() && mailboxCount === 0)
          ? { fromEmail }
          : {}),
      },
    });
    identityId = row.id;
    if (mailboxCount === 0) {
      await ensureAtLeastOneMailbox(row.id, advertiserId, fromEmail, fromName || row.fromName);
    } else if (fromEmailInput?.trim()) {
      // Ensure requested email exists as a mailbox (first add path on re-register)
      const normalized = fromEmail;
      const has = existing.mailboxes.some((m) => m.email === normalized);
      if (!has) {
        await prisma.advertiserSendingMailbox.create({
          data: {
            identityId: row.id,
            advertiserId,
            email: normalized,
            fromName: fromName || row.fromName,
            isDefault: false,
          },
        });
      }
    }
  } else {
    const count = await prisma.advertiserSendingIdentity.count({ where: { advertiserId } });
    const row = await prisma.advertiserSendingIdentity.create({
      data: {
        advertiserId,
        domain: normalizedDomain,
        fromEmail,
        fromName,
        dkimTokens,
        verificationStatus,
        isDefault: count === 0,
      },
    });
    identityId = row.id;
    await ensureAtLeastOneMailbox(row.id, advertiserId, fromEmail, fromName);
  }

  return loadIdentityWithMailboxes(identityId);
}

async function requestMailgunDomainVerification(
  advertiserId: string,
  normalizedDomain: string,
  fromName: string,
  fromEmail?: string | null,
) {
  const created = await createMailgunDomain(normalizedDomain);
  if (!created.ok) {
    throw new AppError("MAILGUN_ERROR", created.error, created.status === 503 ? 503 : 502);
  }

  const verified = isMailgunDomainReady(created.data.state);
  const row = await upsertLocalIdentity(
    advertiserId,
    normalizedDomain,
    fromName,
    mailgunMetaFromDetails(created.data),
    verified ? "VERIFIED" : "PENDING",
    fromEmail,
  );
  return serializeSendingIdentity(row);
}

export async function requestDomainVerification(
  advertiserId: string,
  domain: string,
  fromName: string,
  fromEmail?: string | null,
) {
  const normalizedDomain = domain.trim().toLowerCase();
  if (!normalizedDomain || !normalizedDomain.includes(".")) {
    throw new AppError("VALIDATION_ERROR", "Enter a valid domain", 422);
  }

  // Validate early when provided
  if (fromEmail?.trim()) {
    normalizeFromEmailForDomain(fromEmail, normalizedDomain);
  }

  if (!isMailgunConfigured()) {
    throw new AppError(
      "PROVIDER_NOT_CONFIGURED",
      "Mailgun is not configured by platform admin.",
      503,
    );
  }

  return requestMailgunDomainVerification(
    advertiserId,
    normalizedDomain,
    fromName,
    fromEmail,
  );
}

export async function updateIdentityFromEmail(
  advertiserId: string,
  identityId: string,
  fromEmail: string,
) {
  const identity = await prisma.advertiserSendingIdentity.findFirst({
    where: { id: identityId, advertiserId },
    include: { mailboxes: true },
  });
  if (!identity) throw new AppError("NOT_FOUND", "Sending identity not found", 404);

  const normalized = normalizeFromEmailForDomain(fromEmail, identity.domain);
  const existingMailbox = identity.mailboxes.find((m) => m.email === normalized);

  if (existingMailbox) {
    await prisma.advertiserSendingMailbox.updateMany({
      where: { identityId },
      data: { isDefault: false },
    });
    await prisma.advertiserSendingMailbox.update({
      where: { id: existingMailbox.id },
      data: { isDefault: true, fromName: identity.fromName },
    });
  } else if (identity.mailboxes.length === 0) {
    await prisma.advertiserSendingMailbox.create({
      data: {
        identityId,
        advertiserId,
        email: normalized,
        fromName: identity.fromName,
        isDefault: true,
      },
    });
  } else {
    // Treat as updating the default mailbox address
    const def = identity.mailboxes.find((m) => m.isDefault) ?? identity.mailboxes[0];
    await prisma.advertiserSendingMailbox.update({
      where: { id: def.id },
      data: { email: normalized, isDefault: true },
    });
    await prisma.advertiserSendingMailbox.updateMany({
      where: { identityId, id: { not: def.id } },
      data: { isDefault: false },
    });
  }

  await prisma.advertiserSendingIdentity.update({
    where: { id: identity.id },
    data: { fromEmail: normalized },
  });
  return serializeSendingIdentity(await loadIdentityWithMailboxes(identity.id));
}

export async function addIdentityMailbox(
  advertiserId: string,
  identityId: string,
  fromEmail: string,
  fromName?: string | null,
) {
  const identity = await prisma.advertiserSendingIdentity.findFirst({
    where: { id: identityId, advertiserId },
  });
  if (!identity) throw new AppError("NOT_FOUND", "Sending identity not found", 404);
  if (identity.verificationStatus !== "VERIFIED") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Verify the domain before adding more sending emails",
      422,
    );
  }

  const normalized = normalizeFromEmailForDomain(fromEmail, identity.domain);
  const duplicate = await prisma.advertiserSendingMailbox.findFirst({
    where: { advertiserId, email: normalized },
  });
  if (duplicate) {
    throw new AppError("VALIDATION_ERROR", "That sending email already exists", 422);
  }

  const count = await prisma.advertiserSendingMailbox.count({ where: { identityId } });
  await prisma.advertiserSendingMailbox.create({
    data: {
      identityId,
      advertiserId,
      email: normalized,
      fromName: fromName?.trim() || identity.fromName,
      isDefault: count === 0,
    },
  });
  if (count === 0) {
    await syncIdentityFromDefaultMailbox(identityId);
  }
  return serializeSendingIdentity(await loadIdentityWithMailboxes(identityId));
}

export async function removeIdentityMailbox(
  advertiserId: string,
  identityId: string,
  mailboxId: string,
) {
  const identity = await prisma.advertiserSendingIdentity.findFirst({
    where: { id: identityId, advertiserId },
    include: { mailboxes: true },
  });
  if (!identity) throw new AppError("NOT_FOUND", "Sending identity not found", 404);

  const mailbox = identity.mailboxes.find((m) => m.id === mailboxId);
  if (!mailbox) throw new AppError("NOT_FOUND", "Sending email not found", 404);
  if (identity.mailboxes.length <= 1) {
    throw new AppError("VALIDATION_ERROR", "Keep at least one sending email on the domain", 422);
  }

  await prisma.advertiserSendingMailbox.delete({ where: { id: mailbox.id } });

  if (mailbox.isDefault) {
    const next = await prisma.advertiserSendingMailbox.findFirst({
      where: { identityId },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await prisma.advertiserSendingMailbox.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
      await syncIdentityFromDefaultMailbox(identityId);
    }
  }

  return serializeSendingIdentity(await loadIdentityWithMailboxes(identityId));
}

export async function setDefaultIdentityMailbox(
  advertiserId: string,
  identityId: string,
  mailboxId: string,
) {
  const identity = await prisma.advertiserSendingIdentity.findFirst({
    where: { id: identityId, advertiserId },
  });
  if (!identity) throw new AppError("NOT_FOUND", "Sending identity not found", 404);

  const mailbox = await prisma.advertiserSendingMailbox.findFirst({
    where: { id: mailboxId, identityId, advertiserId },
  });
  if (!mailbox) throw new AppError("NOT_FOUND", "Sending email not found", 404);

  await prisma.advertiserSendingMailbox.updateMany({
    where: { identityId },
    data: { isDefault: false },
  });
  await prisma.advertiserSendingMailbox.update({
    where: { id: mailbox.id },
    data: { isDefault: true },
  });
  await syncIdentityFromDefaultMailbox(identityId);
  await syncAdvertiserSettingsFromMailbox(
    advertiserId,
    mailbox.email,
    mailbox.fromName ?? identity.fromName,
  );

  return serializeSendingIdentity(await loadIdentityWithMailboxes(identityId));
}

async function refreshMailgunDomainVerification(identity: {
  id: string;
  domain: string;
}) {
  const verified = await verifyMailgunDomain(identity.domain);
  let details: MailgunDomainDetails | null = verified.ok ? verified.data : null;

  if (!details) {
    const got = await getMailgunDomain(identity.domain);
    if (!got.ok) {
      throw new AppError(
        "MAILGUN_ERROR",
        !verified.ok ? verified.error : got.error,
        502,
      );
    }
    details = got.data;
  }

  const row = await prisma.advertiserSendingIdentity.update({
    where: { id: identity.id },
    data: {
      verificationStatus: isMailgunDomainReady(details.state) ? "VERIFIED" : "PENDING",
      dkimTokens: mailgunMetaFromDetails(details),
    },
  });
  return serializeSendingIdentity(await loadIdentityWithMailboxes(row.id));
}

export async function refreshDomainVerification(advertiserId: string, identityId: string) {
  const identity = await prisma.advertiserSendingIdentity.findFirst({
    where: { id: identityId, advertiserId },
  });
  if (!identity) throw new AppError("NOT_FOUND", "Sending identity not found", 404);

  if (!isMailgunConfigured()) {
    throw new AppError(
      "PROVIDER_NOT_CONFIGURED",
      "Mailgun is not configured by platform admin.",
      503,
    );
  }
  const serialized = await refreshMailgunDomainVerification(identity);

  if (serialized.verificationStatus === "VERIFIED") {
    const settings = await prisma.advertiserEmailSettings.findUnique({
      where: { advertiserId },
    });
    if (!settings?.fromEmail?.trim()) {
      const def =
        serialized.mailboxes.find((m) => m.isDefault) ?? serialized.mailboxes[0];
      if (def) {
        await syncAdvertiserSettingsFromMailbox(
          advertiserId,
          def.email,
          def.fromName ?? serialized.fromName,
        );
      }
    }
  }

  return serialized;
}

export async function setDefaultIdentity(advertiserId: string, identityId: string) {
  const identity = await prisma.advertiserSendingIdentity.findFirst({
    where: { id: identityId, advertiserId, verificationStatus: "VERIFIED" },
    include: {
      mailboxes: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
    },
  });
  if (!identity) throw new AppError("NOT_FOUND", "Verified identity not found", 404);

  await prisma.advertiserSendingIdentity.updateMany({
    where: { advertiserId },
    data: { isDefault: false },
  });

  const row = await prisma.advertiserSendingIdentity.update({
    where: { id: identityId },
    data: { isDefault: true },
  });

  const def =
    identity.mailboxes.find((m) => m.isDefault) ?? identity.mailboxes[0] ?? null;
  if (def) {
    await syncAdvertiserSettingsFromMailbox(
      advertiserId,
      def.email,
      def.fromName ?? identity.fromName,
    );
  }

  return serializeSendingIdentity(await loadIdentityWithMailboxes(row.id));
}

export async function deleteSendingIdentity(advertiserId: string, identityId: string) {
  const identity = await prisma.advertiserSendingIdentity.findFirst({
    where: { id: identityId, advertiserId },
  });
  if (!identity) throw new AppError("NOT_FOUND", "Sending identity not found", 404);

  if (isMailgunConfigured()) {
    await deleteMailgunDomain(identity.domain);
  }

  await prisma.advertiserSendingIdentity.delete({ where: { id: identityId } });

  if (identity.isDefault) {
    const next = await prisma.advertiserSendingIdentity.findFirst({
      where: { advertiserId, verificationStatus: "VERIFIED" },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await prisma.advertiserSendingIdentity.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  return { id: identityId };
}
