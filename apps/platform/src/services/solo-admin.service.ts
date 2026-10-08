import { getTrackingUrl } from "@cpl/shared";
import {
  generateSecret,
  isValidTimeZone,
  loadSoloAdsConfig,
  parseSoloAdsConfig,
  refundSoloClick,
  SOLO_ADS_SETTINGS_KEY,
  utcDate,
  type SoloAdsConfig,
} from "@cpl/tracking-core";
import type { SoloProviderClass, SoloProviderStatus, SoloTrafficType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, Errors } from "@/lib/errors";
import { notifyUserById } from "@/services/notify.service";

async function audit(actorId: string, action: string, entityType: string, entityId: string, metadata?: object) {
  await prisma.auditLog.create({ data: { actorId, action, entityType, entityId, metadata: metadata as never } });
}

export function soloRouterUrl(trafficType: SoloTrafficType, token?: string) {
  const pool = trafficType === "WARM" ? "warm" : "regular";
  const base = `${getTrackingUrl()}/sa/${pool}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

// ---------------------------------------------------------------- settings

export async function updateSoloAdsSettings(adminId: string, input: Partial<SoloAdsConfig>) {
  const current = await loadSoloAdsConfig();
  if (input.defaultTimezone && !isValidTimeZone(input.defaultTimezone)) {
    throw Errors.validation("Unknown timezone", "defaultTimezone");
  }
  if (input.betaPublisherIds) {
    const found = await prisma.user.count({ where: { id: { in: input.betaPublisherIds }, role: "PUBLISHER" } });
    if (found !== new Set(input.betaPublisherIds).size) throw Errors.validation("Unknown affiliate in beta list", "betaPublisherIds");
  }
  const next = parseSoloAdsConfig({ ...current, ...input });
  await prisma.platformSetting.upsert({
    where: { key: SOLO_ADS_SETTINGS_KEY },
    create: { key: SOLO_ADS_SETTINGS_KEY, value: next as never },
    update: { value: next as never },
  });
  const changed = Object.keys(next).filter(
    (k) => JSON.stringify(next[k as keyof SoloAdsConfig]) !== JSON.stringify(current[k as keyof SoloAdsConfig]),
  );
  await audit(adminId, "solo.settings.updated", "platform_settings", SOLO_ADS_SETTINGS_KEY, {
    changed,
    before: Object.fromEntries(changed.map((k) => [k, current[k as keyof SoloAdsConfig]])),
    after: Object.fromEntries(changed.map((k) => [k, next[k as keyof SoloAdsConfig]])),
  });
  return next;
}

export async function listBetaPublishers(ids: string[]) {
  if (ids.length === 0) return [];
  return prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true, memberNo: true },
  });
}

// ---------------------------------------------------------------- providers

export async function listSoloProviders() {
  const today = utcDate(new Date());
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [providers, stats] = await Promise.all([
    prisma.soloProvider.findMany({
      orderBy: { publicCode: "asc" },
      include: {
        tokens: { orderBy: { createdAt: "desc" } },
        usage: { where: { date: today }, take: 1 },
      },
    }),
    prisma.soloClick.groupBy({
      by: ["providerId", "billingStatus"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);
  return providers.map((p) => {
    const rows = stats.filter((s) => s.providerId === p.id);
    const count = (status: string) => rows.find((r) => r.billingStatus === status)?._count._all ?? 0;
    const total = rows.reduce((sum, r) => sum + r._count._all, 0);
    return {
      ...p,
      clicksToday: p.usage[0]?.clicks ?? 0,
      last30: {
        total,
        billed: count("BILLED"),
        invalid: count("INVALID") + count("REFUNDED"),
        fallback: count("FALLBACK"),
      },
    };
  });
}

type ProviderInput = {
  realName?: string;
  contact?: string | null;
  trafficClass?: SoloProviderClass;
  status?: SoloProviderStatus;
  geoRules?: string[];
  dailyCapacity?: number | null;
  notes?: string | null;
};

function normalizeProviderInput(input: ProviderInput) {
  const geo = input.geoRules?.map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c));
  if (input.dailyCapacity != null && (!Number.isInteger(input.dailyCapacity) || input.dailyCapacity < 1)) {
    throw Errors.validation("Daily capacity must be a whole number above zero", "dailyCapacity");
  }
  return {
    ...(input.realName !== undefined ? { realName: input.realName.trim().slice(0, 191) } : {}),
    ...(input.contact !== undefined ? { contact: input.contact?.trim() || null } : {}),
    ...(input.trafficClass ? { trafficClass: input.trafficClass } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(geo !== undefined ? { geoRules: geo } : {}),
    ...(input.dailyCapacity !== undefined ? { dailyCapacity: input.dailyCapacity } : {}),
    ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
  };
}

export async function createSoloProvider(adminId: string, input: ProviderInput) {
  if (!input.realName?.trim()) throw Errors.validation("Enter the provider name", "realName");
  const data = normalizeProviderInput(input);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const max = await prisma.soloProvider.aggregate({ _max: { publicCode: true } });
    const publicCode = Math.max(100, max._max.publicCode ?? 100) + 1;
    try {
      const provider = await prisma.soloProvider.create({
        data: { realName: input.realName.trim(), ...data, publicCode },
      });
      await audit(adminId, "solo.provider.created", "solo_provider", provider.id, { publicCode });
      return provider;
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  throw new AppError("PROVIDER_CODE_CONFLICT", "Could not allocate a provider number, try again", 409);
}

export async function updateSoloProvider(adminId: string, providerId: string, input: ProviderInput) {
  const before = await prisma.soloProvider.findUnique({ where: { id: providerId } });
  if (!before) throw Errors.notFound("Provider");
  const provider = await prisma.soloProvider.update({ where: { id: providerId }, data: normalizeProviderInput(input) });
  await audit(adminId, "solo.provider.updated", "solo_provider", providerId, {
    before: { status: before.status, trafficClass: before.trafficClass, dailyCapacity: before.dailyCapacity },
    after: { status: provider.status, trafficClass: provider.trafficClass, dailyCapacity: provider.dailyCapacity },
  });
  return provider;
}

/** Issue a new signed delivery token. The secret is returned once and never stored. */
export async function issueSoloProviderToken(adminId: string, providerId: string, trafficType: SoloTrafficType) {
  const provider = await prisma.soloProvider.findUnique({ where: { id: providerId } });
  if (!provider) throw Errors.notFound("Provider");
  if (provider.trafficClass !== "BOTH" && provider.trafficClass !== trafficType) {
    throw Errors.validation(`This provider only delivers ${provider.trafficClass.toLowerCase()} traffic`, "trafficType");
  }
  const { secret, hash, prefix } = generateSecret(trafficType === "WARM" ? "spw" : "spr");
  const token = await prisma.soloProviderToken.create({
    data: { providerId, trafficType, tokenHash: hash, prefix, createdById: adminId },
  });
  await audit(adminId, "solo.provider.token_issued", "solo_provider", providerId, { tokenId: token.id, trafficType, prefix });
  return { token: { id: token.id, prefix, trafficType }, secret, url: soloRouterUrl(trafficType, secret) };
}

export async function revokeSoloProviderToken(adminId: string, providerId: string, tokenId: string) {
  const token = await prisma.soloProviderToken.findFirst({ where: { id: tokenId, providerId } });
  if (!token) throw Errors.notFound("Token");
  if (token.status === "REVOKED") return token;
  const updated = await prisma.soloProviderToken.update({
    where: { id: tokenId },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  await audit(adminId, "solo.provider.token_revoked", "solo_provider", providerId, { tokenId, prefix: token.prefix });
  return updated;
}

// ---------------------------------------------------------------- campaigns

const CAMPAIGN_ADMIN_INCLUDE = {
  publisher: { select: { id: true, name: true, email: true, memberNo: true } },
  cpaOffer: { select: { id: true, name: true, status: true } },
  digitalProduct: { select: { id: true, name: true, status: true } },
} as const;

export async function listSoloCampaignsForAdmin(filter: { status?: string | null; q?: string | null } = {}) {
  const q = filter.q?.trim();
  return prisma.soloCampaign.findMany({
    where: {
      ...(filter.status ? { status: filter.status as never } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { id: q },
              { publisher: { email: { contains: q } } },
              { publisher: { name: { contains: q } } },
            ],
          }
        : {}),
    },
    orderBy: [{ submittedAt: "asc" }, { createdAt: "desc" }],
    include: CAMPAIGN_ADMIN_INCLUDE,
    take: 200,
  });
}

export type AdminCampaignAction = "approve" | "reject" | "pause" | "resume" | "terminate" | "priority" | "verify_tracking";

export async function reviewSoloCampaign(
  adminId: string,
  campaignId: string,
  input: { action: AdminCampaignAction; reason?: string | null; priority?: number },
) {
  const campaign = await prisma.soloCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw Errors.notFound("Campaign");
  const reason = input.reason?.trim() || null;
  const now = new Date();
  let data: Parameters<typeof prisma.soloCampaign.update>[0]["data"];
  let notify: { title: string; message: string; type: string } | null = null;

  switch (input.action) {
    case "approve":
      if (campaign.status !== "PENDING_REVIEW") throw Errors.validation("Only campaigns waiting for review can be approved");
      data = { status: "ACTIVE", statusReason: null, reviewedAt: now, reviewedById: adminId };
      notify = {
        title: "Solo Ads campaign approved",
        message: `"${campaign.name}" was approved and will receive traffic while it has budget and funds.`,
        type: "solo.campaign.approved",
      };
      break;
    case "reject":
      if (!reason) throw Errors.validation("Enter a reason for rejecting the campaign", "reason");
      if (campaign.status !== "PENDING_REVIEW") throw Errors.validation("Only campaigns waiting for review can be rejected");
      data = { status: "REJECTED", statusReason: reason, reviewedAt: now, reviewedById: adminId };
      notify = {
        title: "Solo Ads campaign needs changes",
        message: `"${campaign.name}" was not approved: ${reason}`,
        type: "solo.campaign.rejected",
      };
      break;
    case "pause":
      if (!reason) throw Errors.validation("Enter a reason for pausing", "reason");
      data = { status: "PAUSED", statusReason: `Paused by Affsense: ${reason}` };
      notify = { title: "Solo Ads campaign paused", message: `"${campaign.name}" was paused: ${reason}`, type: "solo.campaign.paused" };
      break;
    case "resume":
      if (campaign.status !== "PAUSED") throw Errors.validation("Only paused campaigns can be resumed");
      data = { status: "ACTIVE", statusReason: null };
      break;
    case "terminate":
      if (!reason) throw Errors.validation("Enter a reason for ending the campaign", "reason");
      data = { status: "COMPLETED", statusReason: `Ended by Affsense: ${reason}` };
      notify = { title: "Solo Ads campaign ended", message: `"${campaign.name}" was ended: ${reason}`, type: "solo.campaign.ended" };
      break;
    case "priority": {
      const priority = Math.round(Number(input.priority));
      if (!Number.isInteger(priority) || priority < 1 || priority > 10) throw Errors.validation("Priority must be 1-10", "priority");
      if (!reason) throw Errors.validation("Enter a reason for the priority change", "reason");
      data = { priority };
      break;
    }
    case "verify_tracking":
      if (campaign.destinationMode !== "EXTERNAL") throw Errors.validation("Only campaigns with their own landing page need this");
      if (!reason) throw Errors.validation("Explain how tracking was verified", "reason");
      data = { trackingVerifiedAt: now };
      break;
    default:
      throw Errors.validation("Unknown action");
  }

  const updated = await prisma.soloCampaign.update({ where: { id: campaignId }, data });
  await audit(adminId, `solo.campaign.${input.action}`, "solo_campaign", campaignId, {
    before: { status: campaign.status, priority: campaign.priority },
    after: { status: updated.status, priority: updated.priority },
    reason,
  });
  if (notify) {
    void notifyUserById(campaign.publisherId, {
      title: notify.title,
      message: notify.message,
      actionPath: `/publisher/solo-ads/campaigns/${campaign.id}`,
      notificationType: notify.type,
    }).catch((error) => console.error("[solo] campaign notify failed", error));
  }
  return updated;
}

export async function adminRefundSoloClick(adminId: string, clickId: string, reason: string) {
  const text = reason.trim();
  if (text.length < 3) throw Errors.validation("Enter a reason", "reason");
  const refunded = await refundSoloClick(clickId, { actorId: adminId, reason: text });
  if (!refunded) throw Errors.validation("Only billed clicks can be refunded");
  await audit(adminId, "solo.click.refunded", "solo_click", clickId, { reason: text });
  return refunded;
}
