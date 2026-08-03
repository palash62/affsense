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

function asDkimTokens(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((t): t is string => typeof t === "string" && t.length > 0);
}

export type DnsRecord = {
  type: "CNAME" | "TXT";
  name: string;
  value: string;
  purpose: "DKIM" | "SPF" | "DMARC";
};

export function buildDnsRecords(domain: string, dkimTokens: string[]): DnsRecord[] {
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
  const dkimTokens = asDkimTokens(identity.dkimTokens);
  const ready = identity.verificationStatus === "VERIFIED";
  return {
    id: identity.id,
    domain: identity.domain,
    fromEmail: identity.fromEmail,
    fromName: identity.fromName,
    verificationStatus: identity.verificationStatus,
    isDefault: identity.isDefault,
    dkimTokens,
    ready,
    dkimReady: ready,
    /** Instructional only in v1 — not live DNS probes */
    spfReady: false,
    dmarcReady: false,
    dnsRecords: buildDnsRecords(identity.domain, dkimTokens),
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

export async function requestDomainVerification(
  advertiserId: string,
  domain: string,
  fromName: string,
) {
  const config = await getResolvedSesConfig();
  if (!config.enabled) {
    throw new AppError(
      "SES_NOT_CONFIGURED",
      "SES is not configured by platform admin. Custom sending domains require Amazon SES.",
      503,
    );
  }

  const normalizedDomain = domain.trim().toLowerCase();
  const fromEmail = `noreply@${normalizedDomain}`;
  const client = getSesClient(config);

  try {
    const result = await client.send(
      new CreateEmailIdentityCommand({
        EmailIdentity: normalizedDomain,
        DkimSigningAttributes: { NextSigningKeyLength: "RSA_2048_BIT" },
      }),
    );

    const dkimTokens = result.DkimAttributes?.Tokens ?? [];

    const existing = await prisma.advertiserSendingIdentity.findUnique({
      where: { advertiserId_domain: { advertiserId, domain: normalizedDomain } },
    });

    if (existing) {
      const row = await prisma.advertiserSendingIdentity.update({
        where: { id: existing.id },
        data: {
          dkimTokens,
          fromName,
          verificationStatus: "PENDING",
        },
      });
      return serializeSendingIdentity(row);
    }

    const count = await prisma.advertiserSendingIdentity.count({ where: { advertiserId } });
    const row = await prisma.advertiserSendingIdentity.create({
      data: {
        advertiserId,
        domain: normalizedDomain,
        fromEmail,
        fromName,
        dkimTokens,
        verificationStatus: "PENDING",
        isDefault: count === 0,
      },
    });

    return serializeSendingIdentity(row);
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : "Domain verification failed";
    throw new AppError("SES_ERROR", message, 502);
  }
}

export async function refreshDomainVerification(advertiserId: string, identityId: string) {
  const identity = await prisma.advertiserSendingIdentity.findFirst({
    where: { id: identityId, advertiserId },
  });
  if (!identity) throw new AppError("NOT_FOUND", "Sending identity not found", 404);

  const config = await getResolvedSesConfig();
  if (!config.enabled) {
    throw new AppError(
      "SES_NOT_CONFIGURED",
      "SES is not configured by platform admin. Custom sending domains require Amazon SES.",
      503,
    );
  }
  const client = getSesClient(config);

  try {
    const result = await client.send(
      new GetEmailIdentityCommand({ EmailIdentity: identity.domain }),
    );

    const verified = result.VerifiedForSendingStatus === true;
    const row = await prisma.advertiserSendingIdentity.update({
      where: { id: identityId },
      data: {
        verificationStatus: verified ? "VERIFIED" : "PENDING",
        dkimTokens: (result.DkimAttributes?.Tokens ?? identity.dkimTokens) as Prisma.InputJsonValue,
      },
    });
    return serializeSendingIdentity(row);
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : "Verification check failed";
    throw new AppError("SES_ERROR", message, 502);
  }
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

  const config = await getResolvedSesConfig();
  if (config.enabled) {
    try {
      const client = getSesClient(config);
      await client.send(
        new DeleteEmailIdentityCommand({ EmailIdentity: identity.domain }),
      );
    } catch {
      // Still remove local row if SES identity is already gone
    }
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
