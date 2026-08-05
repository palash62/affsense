import type { Prisma } from "@prisma/client";
import {
  SESv2Client,
  CreateEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  GetEmailIdentityCommand,
} from "@aws-sdk/client-sesv2";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { getResolvedSesConfig } from "@/services/ses-settings.service";
import {
  createMailgunDomain,
  deleteMailgunDomain,
  getMailgunDomain,
  isMailgunConfigured,
  type MailgunDnsRecordRaw,
  type MailgunDomainDetails,
  verifyMailgunDomain,
} from "@/lib/email/mailgun";

function getSesClient(config: Awaited<ReturnType<typeof getResolvedSesConfig>>) {
  return new SESv2Client({
    region: config.region,
    credentials:
      config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined,
  });
}

export type DnsRecord = {
  type: "CNAME" | "TXT" | "MX";
  name: string;
  value: string;
  purpose: "DKIM" | "SPF" | "DMARC" | "TRACKING" | "MX";
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

export function buildSesDnsRecords(domain: string, dkimTokens: string[]): DnsRecord[] {
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

/** @deprecated Use buildSesDnsRecords */
export const buildDnsRecords = buildSesDnsRecords;

function guessMailgunPurpose(
  record: MailgunDnsRecordRaw,
): DnsRecord["purpose"] {
  const type = (record.record_type ?? "").toUpperCase();
  const name = (record.name ?? "").toLowerCase();
  const value = (record.value ?? "").toLowerCase();

  if (type === "MX") return "MX";
  if (name.includes("_dmarc") || value.includes("v=dmarc1")) return "DMARC";
  if (value.includes("v=spf1") || value.includes("include:mailgun.org")) return "SPF";
  if (name.includes("_domainkey") || value.includes("dkim") || type === "TXT" && name.includes("k=")) {
    return "DKIM";
  }
  if (type === "CNAME" && (name.includes("email") || value.includes("mailgun.org"))) {
    return "TRACKING";
  }
  if (type === "TXT" && value.includes("k=rsa")) return "DKIM";
  if (type === "CNAME") return "TRACKING";
  return "DKIM";
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
    mapped.push({
      type,
      name,
      value: rec.priority != null && type === "MX" ? `${rec.priority} ${value}` : value,
      purpose: guessMailgunPurpose(rec),
    });
  }

  for (const rec of details.receivingDnsRecords) {
    const typeRaw = (rec.record_type ?? "MX").toUpperCase();
    const type: DnsRecord["type"] =
      typeRaw === "CNAME" ? "CNAME" : typeRaw === "MX" ? "MX" : "TXT";
    const name = rec.name?.trim();
    const value = rec.value?.trim();
    if (!name || !value) continue;
    mapped.push({
      type,
      name,
      value: rec.priority != null && type === "MX" ? `${rec.priority} ${value}` : value,
      purpose: type === "MX" ? "MX" : guessMailgunPurpose(rec),
    });
  }

  return mapped;
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

export function serializeSendingIdentity<
  T extends {
    id: string;
    domain: string;
    fromEmail: string;
    fromName: string;
    verificationStatus: string;
    isDefault: boolean;
    dkimTokens: unknown;
    createdAt: Date;
    updatedAt: Date;
  },
>(identity: T) {
  const ready = identity.verificationStatus === "VERIFIED";
  const meta = asStoredMeta(identity.dkimTokens);
  let dnsRecords: DnsRecord[] = [];
  let dkimTokens: string[] = [];
  let provider: "ses" | "mailgun" | "unknown" = "unknown";

  if (Array.isArray(meta)) {
    provider = "ses";
    dkimTokens = asDkimTokens(meta);
    dnsRecords = buildSesDnsRecords(identity.domain, dkimTokens);
  } else if (meta && typeof meta === "object" && "provider" in meta) {
    provider = meta.provider === "mailgun" ? "mailgun" : "ses";
    if (provider === "mailgun" && Array.isArray(meta.records)) {
      dnsRecords = meta.records;
    } else {
      dkimTokens = asDkimTokens(meta.tokens ?? []);
      dnsRecords = buildSesDnsRecords(identity.domain, dkimTokens);
    }
  } else {
    dkimTokens = asDkimTokens(identity.dkimTokens);
    dnsRecords = buildSesDnsRecords(identity.domain, dkimTokens);
    provider = dkimTokens.length ? "ses" : "unknown";
  }

  const hasSpf = dnsRecords.some((r) => r.purpose === "SPF");
  const hasDmarc = dnsRecords.some((r) => r.purpose === "DMARC");

  return {
    id: identity.id,
    domain: identity.domain,
    fromEmail: identity.fromEmail,
    fromName: identity.fromName,
    verificationStatus: identity.verificationStatus,
    isDefault: identity.isDefault,
    dkimTokens,
    provider,
    ready,
    dkimReady: ready,
    /** SPF/DMARC instructional until live probes exist */
    spfReady: ready && hasSpf ? false : false,
    dmarcReady: ready && hasDmarc ? false : false,
    dnsRecords,
    createdAt: identity.createdAt.toISOString(),
    updatedAt: identity.updatedAt.toISOString(),
  };
}

export async function listSendingIdentities(advertiserId: string) {
  const rows = await prisma.advertiserSendingIdentity.findMany({
    where: { advertiserId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serializeSendingIdentity);
}

async function upsertLocalIdentity(
  advertiserId: string,
  normalizedDomain: string,
  fromName: string,
  dkimTokens: Prisma.InputJsonValue,
  verificationStatus: "PENDING" | "VERIFIED" = "PENDING",
) {
  const fromEmail = `noreply@${normalizedDomain}`;
  const existing = await prisma.advertiserSendingIdentity.findUnique({
    where: { advertiserId_domain: { advertiserId, domain: normalizedDomain } },
  });

  if (existing) {
    return prisma.advertiserSendingIdentity.update({
      where: { id: existing.id },
      data: {
        dkimTokens,
        fromName,
        fromEmail,
        verificationStatus,
      },
    });
  }

  const count = await prisma.advertiserSendingIdentity.count({ where: { advertiserId } });
  return prisma.advertiserSendingIdentity.create({
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
}

async function requestSesDomainVerification(
  advertiserId: string,
  normalizedDomain: string,
  fromName: string,
  config: Awaited<ReturnType<typeof getResolvedSesConfig>>,
) {
  const client = getSesClient(config);
  try {
    const result = await client.send(
      new CreateEmailIdentityCommand({
        EmailIdentity: normalizedDomain,
        DkimSigningAttributes: { NextSigningKeyLength: "RSA_2048_BIT" },
      }),
    );

    const tokens = result.DkimAttributes?.Tokens ?? [];
    const payload: Prisma.InputJsonValue = {
      provider: "ses",
      tokens,
    };
    const row = await upsertLocalIdentity(advertiserId, normalizedDomain, fromName, payload);
    return serializeSendingIdentity(row);
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : "Domain verification failed";
    throw new AppError("SES_ERROR", message, 502);
  }
}

async function requestMailgunDomainVerification(
  advertiserId: string,
  normalizedDomain: string,
  fromName: string,
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
  );
  return serializeSendingIdentity(row);
}

export async function requestDomainVerification(
  advertiserId: string,
  domain: string,
  fromName: string,
) {
  const normalizedDomain = domain.trim().toLowerCase();
  if (!normalizedDomain || !normalizedDomain.includes(".")) {
    throw new AppError("VALIDATION_ERROR", "Enter a valid domain", 422);
  }

  const sesConfig = await getResolvedSesConfig();
  if (sesConfig.enabled) {
    return requestSesDomainVerification(advertiserId, normalizedDomain, fromName, sesConfig);
  }

  if (isMailgunConfigured()) {
    return requestMailgunDomainVerification(advertiserId, normalizedDomain, fromName);
  }

  throw new AppError(
    "PROVIDER_NOT_CONFIGURED",
    "Email sending provider is not configured by platform admin.",
    503,
  );
}

async function refreshSesDomainVerification(
  identity: { id: string; domain: string; dkimTokens: unknown },
  config: Awaited<ReturnType<typeof getResolvedSesConfig>>,
) {
  const client = getSesClient(config);
  try {
    const result = await client.send(
      new GetEmailIdentityCommand({ EmailIdentity: identity.domain }),
    );
    const verified = result.VerifiedForSendingStatus === true;
    const tokens = result.DkimAttributes?.Tokens ?? asDkimTokens(identity.dkimTokens);
    const row = await prisma.advertiserSendingIdentity.update({
      where: { id: identity.id },
      data: {
        verificationStatus: verified ? "VERIFIED" : "PENDING",
        dkimTokens: { provider: "ses", tokens } as Prisma.InputJsonValue,
      },
    });
    return serializeSendingIdentity(row);
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : "Verification check failed";
    throw new AppError("SES_ERROR", message, 502);
  }
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
  return serializeSendingIdentity(row);
}

export async function refreshDomainVerification(advertiserId: string, identityId: string) {
  const identity = await prisma.advertiserSendingIdentity.findFirst({
    where: { id: identityId, advertiserId },
  });
  if (!identity) throw new AppError("NOT_FOUND", "Sending identity not found", 404);

  const sesConfig = await getResolvedSesConfig();
  if (sesConfig.enabled) {
    return refreshSesDomainVerification(identity, sesConfig);
  }

  if (isMailgunConfigured()) {
    return refreshMailgunDomainVerification(identity);
  }

  throw new AppError(
    "PROVIDER_NOT_CONFIGURED",
    "Email sending provider is not configured by platform admin.",
    503,
  );
}

export async function setDefaultIdentity(advertiserId: string, identityId: string) {
  const identity = await prisma.advertiserSendingIdentity.findFirst({
    where: { id: identityId, advertiserId, verificationStatus: "VERIFIED" },
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
  return serializeSendingIdentity(row);
}

export async function deleteSendingIdentity(advertiserId: string, identityId: string) {
  const identity = await prisma.advertiserSendingIdentity.findFirst({
    where: { id: identityId, advertiserId },
  });
  if (!identity) throw new AppError("NOT_FOUND", "Sending identity not found", 404);

  const sesConfig = await getResolvedSesConfig();
  if (sesConfig.enabled) {
    try {
      const client = getSesClient(sesConfig);
      await client.send(
        new DeleteEmailIdentityCommand({ EmailIdentity: identity.domain }),
      );
    } catch {
      // Still remove local row if SES identity is already gone
    }
  } else if (isMailgunConfigured()) {
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
