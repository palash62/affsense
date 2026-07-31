import { campaignExcludesBlockedPublishers } from "@/lib/campaign-targeting";
import {
  filterCampaignsByCountry,
  filterCampaignsByDeviceOs,
  pickCampaignForIpRotation,
} from "@/lib/smart-link-rotation";
import { parseUserAgent } from "@/lib/publisher-leads";
import { calculatePublisherPayout } from "@/lib/platform-settings";
import {
  campaignQualifiesForSpecialPayouts,
  readPublisherSpecialTierPayouts,
} from "@/lib/publisher-special-payout";
import { prisma } from "@/lib/prisma";
import { notifyGeneric, notifyUserById } from "@/services/notify.service";
import { createTrackingLink } from "@/services/campaign.service";
import { resolveCampaignLandingUrl } from "@cpl/shared";
import type { Campaign, PublisherSmartLink, User } from "@prisma/client";

export type EligibleCampaign = Campaign & {
  advertiser: Pick<User, "id" | "name" | "email">;
};

export async function getOrCreatePublisherSmartLink(publisherId: string): Promise<PublisherSmartLink> {
  const existing = await prisma.publisherSmartLink.findUnique({
    where: { publisherId },
  });
  if (existing) return existing;

  const slug = `pub-${publisherId.slice(-10)}-${Date.now().toString(36)}`;
  return prisma.publisherSmartLink.create({
    data: { publisherId, slug },
  });
}

export async function getEligibleCampaigns(
  publisherId: string,
  options?: { countryCode?: string },
): Promise<EligibleCampaign[]> {
  const [blockedAdvertisers, publisherProfile] = await Promise.all([
    prisma.advertiserPublisherBlock.findMany({
      where: { publisherId },
      select: { advertiserId: true },
    }),
    prisma.publisherProfile.findUnique({
      where: { userId: publisherId },
      select: {
        useSpecialTierPayouts: true,
        tier1SpecialPayout: true,
        tier2SpecialPayout: true,
        tier3SpecialPayout: true,
      },
    }),
  ]);
  const blockedAdvertiserIds = new Set(blockedAdvertisers.map((row) => row.advertiserId));
  const specialPayouts = readPublisherSpecialTierPayouts(publisherProfile);

  const campaigns = await prisma.campaign.findMany({
    where: {
      status: "ACTIVE",
    },
    include: {
      advertiser: {
        select: {
          id: true,
          name: true,
          email: true,
          wallet: { select: { balance: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const { getPlatformSettings } = await import("@/services/wallet.service");
  const platformSettings = await getPlatformSettings();

  return campaigns.filter((campaign) => {
    const walletBalance = Number(campaign.advertiser.wallet?.balance ?? 0);
    if (walletBalance < Number(campaign.cpl)) return false;

    if (
      campaignExcludesBlockedPublishers(campaign.targeting) &&
      blockedAdvertiserIds.has(campaign.advertiserId)
    ) {
      return false;
    }

    if (specialPayouts.enabled) {
      const cpl = Number(campaign.cpl);
      const qualifies = campaignQualifiesForSpecialPayouts(
        (_tier, sampleCountry) =>
          calculatePublisherPayout(cpl, sampleCountry, platformSettings).publisherAmount,
        specialPayouts,
        options?.countryCode ?? null,
      );
      if (!qualifies) return false;
    }

    return true;
  });
}

export async function ensureTrackingLink(publisherId: string, campaignId: string) {
  const existing = await prisma.trackingLink.findFirst({
    where: { publisherId, campaignId },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  return createTrackingLink(publisherId, campaignId);
}

export async function getCampaignsShownToIp(publisherId: string, ip: string) {
  const [clicks, leads] = await Promise.all([
    prisma.click.findMany({
      where: {
        ip,
        trackingLink: { publisherId },
      },
      select: {
        createdAt: true,
        trackingLink: { select: { campaignId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.lead.findMany({
      where: {
        ip,
        publisherId,
      },
      select: {
        createdAt: true,
        campaignId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const events = [
    ...clicks.map((row) => ({
      campaignId: row.trackingLink.campaignId,
      createdAt: row.createdAt,
    })),
    ...leads.map((row) => ({
      campaignId: row.campaignId,
      createdAt: row.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const row of events) {
    if (!seen.has(row.campaignId)) {
      seen.add(row.campaignId);
      ordered.push(row.campaignId);
    }
  }
  return ordered;
}

async function resolveGlobalLinkFallback(publisherId: string) {
  const publisherProfile = await prisma.publisherProfile.findUnique({
    where: { userId: publisherId },
    select: { globalLinkUrl: true },
  });
  const publisherUrl = publisherProfile?.globalLinkUrl?.trim();
  if (publisherUrl) return publisherUrl;

  const { getPlatformSettings } = await import("@/services/wallet.service");
  const settings = await getPlatformSettings();
  return settings.globalLinkUrl;
}

export async function pickNextCampaign(
  publisherId: string,
  options: { ip: string; countryCode?: string; userAgent?: string | null },
) {
  const smartLink = await getOrCreatePublisherSmartLink(publisherId);
  const eligible = await getEligibleCampaigns(publisherId, {
    countryCode: options.countryCode,
  });
  const countryEligible = filterCampaignsByCountry(eligible, options.countryCode);
  const { device, os } = parseUserAgent(options.userAgent);
  const pool = filterCampaignsByDeviceOs(countryEligible, { device, os });

  if (pool.length === 0) {
    return {
      smartLink,
      eligible,
      campaign: null,
      trackingSlug: null,
      campaignLandingUrl: null,
      globalLinkUrl: await resolveGlobalLinkFallback(publisherId),
      visitorCountry: options.countryCode ?? null,
    };
  }

  const shownCampaignIds = await getCampaignsShownToIp(publisherId, options.ip);
  const campaign = pickCampaignForIpRotation(
    pool,
    shownCampaignIds,
    smartLink.rotationCursor,
  );

  if (!campaign) {
    return {
      smartLink,
      eligible: pool,
      campaign: null,
      trackingSlug: null,
      campaignLandingUrl: null,
      globalLinkUrl: null,
      visitorCountry: options.countryCode ?? null,
    };
  }

  const [updatedSmartLink, trackingLink] = await prisma.$transaction(async (tx) => {
    const updated = await tx.publisherSmartLink.update({
      where: { id: smartLink.id },
      data: { rotationCursor: { increment: 1 } },
    });

    const existing = await tx.trackingLink.findFirst({
      where: { publisherId, campaignId: campaign.id },
      orderBy: { createdAt: "desc" },
    });

    const link =
      existing ??
      (await tx.trackingLink.create({
        data: {
          publisherId,
          campaignId: campaign.id,
          slug: `${publisherId.slice(-6)}-${campaign.id.slice(-6)}-${Date.now().toString(36)}`,
        },
      }));

    return [updated, link] as const;
  });

  return {
    smartLink: updatedSmartLink,
    eligible: pool,
    campaign,
    trackingSlug: trackingLink.slug,
    campaignLandingUrl: resolveCampaignLandingUrl(campaign.targeting, {
      trackingSlug: trackingLink.slug,
    }),
    globalLinkUrl: null,
    visitorCountry: options.countryCode ?? null,
  };
}

export async function resolveSmartLinkBySlug(slug: string) {
  return prisma.publisherSmartLink.findUnique({
    where: { slug },
    include: {
      publisher: {
        select: { id: true, name: true, status: true, role: true },
      },
    },
  });
}

export async function getPublisherSmartLinkDashboard(publisherId: string) {
  const smartLink = await getOrCreatePublisherSmartLink(publisherId);
  const eligible = await getEligibleCampaigns(publisherId);

  const { getPlatformSettings } = await import("@/services/wallet.service");

  const [leadStats, clickStats, publisherProfile, platformSettings] = await Promise.all([
    prisma.lead.groupBy({
      by: ["source"],
      where: { publisherId, source: { not: null } },
      _count: { id: true },
    }),
    prisma.click.groupBy({
      by: ["source"],
      where: {
        source: { not: null },
        trackingLink: { publisherId },
      },
      _count: { id: true },
    }),
    prisma.publisherProfile.findUnique({
      where: { userId: publisherId },
      select: { globalLinkUrl: true },
    }),
    getPlatformSettings(),
  ]);

  const sourceMap = new Map<string, { leads: number; clicks: number }>();

  for (const row of leadStats) {
    const key = row.source ?? "unknown";
    sourceMap.set(key, { leads: row._count.id, clicks: 0 });
  }
  for (const row of clickStats) {
    const key = row.source ?? "unknown";
    const existing = sourceMap.get(key) ?? { leads: 0, clicks: 0 };
    existing.clicks = row._count.id;
    sourceMap.set(key, existing);
  }

  const sourceBreakdown = Array.from(sourceMap.entries())
    .map(([source, stats]) => ({ source, ...stats }))
    .sort((a, b) => b.leads - a.leads);

  return {
    smartLink,
    eligible,
    sourceBreakdown,
    globalLinkUrl: publisherProfile?.globalLinkUrl?.trim() || null,
    platformGlobalLinkUrl: platformSettings.globalLinkUrl,
  };
}

export async function blockPublisher(
  advertiserId: string,
  publisherId: string,
  reason?: string,
) {
  const [block, publisher] = await Promise.all([
    prisma.advertiserPublisherBlock.upsert({
      where: {
        advertiserId_publisherId: { advertiserId, publisherId },
      },
      create: { advertiserId, publisherId, reason },
      update: { reason },
    }),
    prisma.user.findUnique({
      where: { id: publisherId },
      select: { id: true, email: true, name: true },
    }),
  ]);

  if (publisher) {
    void notifyGeneric(publisher, {
      title: "Access restricted",
      message: reason?.trim()
        ? `An advertiser has blocked you from their campaigns. Reason: ${reason.trim()}`
        : "An advertiser has blocked you from their campaigns.",
      actionPath: "/publisher/marketplace",
      notificationType: "publisher.blocked",
    });
  }

  return block;
}

export async function unblockPublisher(advertiserId: string, publisherId: string) {
  const result = await prisma.advertiserPublisherBlock.deleteMany({
    where: { advertiserId, publisherId },
  });

  if (result.count > 0) {
    void notifyUserById(publisherId, {
      title: "Access restored",
      message: "An advertiser has unblocked you. You may join their campaigns again.",
      actionPath: "/publisher/marketplace",
      notificationType: "publisher.unblocked",
    });
  }

  return result;
}

export async function listBlockedPublishers(advertiserId: string) {
  return prisma.advertiserPublisherBlock.findMany({
    where: { advertiserId },
    include: {
      publisher: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function isPublisherBlocked(advertiserId: string, publisherId: string) {
  const block = await prisma.advertiserPublisherBlock.findUnique({
    where: {
      advertiserId_publisherId: { advertiserId, publisherId },
    },
  });
  return Boolean(block);
}
