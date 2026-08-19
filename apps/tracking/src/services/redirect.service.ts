import { prisma } from "@cpl/database";
import { resolveCampaignLandingUrl } from "@cpl/shared";
import { parsePlatformSettings, calculatePublisherPayout } from "@/lib/platform-settings";
import {
  campaignExcludesBlockedPublishers,
  filterCampaignsByCountry,
  filterCampaignsByDeviceOs,
  pickCampaignForIpRotation,
  campaignQualifiesForSpecialPayouts,
  readPublisherSpecialTierPayouts,
} from "@/lib/redirect-helpers";
import { applySmartLinkCampaignAllowlist } from "@/lib/smart-link-rotation";
import { parseUserAgent } from "@/lib/parse-user-agent";
import type { Campaign, PublisherSmartLink } from "@prisma/client";

async function getPlatformSettings() {
  const rows = await prisma.platformSetting.findMany();
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return parsePlatformSettings(map);
}

async function createTrackingLink(publisherId: string, campaignId: string) {
  const slug = `${publisherId.slice(-6)}-${campaignId.slice(-6)}-${Date.now().toString(36)}`;
  return prisma.trackingLink.create({
    data: { publisherId, campaignId, slug },
  });
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

async function getCampaignsShownToIp(publisherId: string, ip: string) {
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

  const settings = await getPlatformSettings();
  return settings.globalLinkUrl;
}

async function getEligibleCampaigns(publisherId: string, options?: { countryCode?: string }) {
  const [blockedAdvertisers, publisherProfile, platformSettings] = await Promise.all([
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
        restrictSmartLinkCampaigns: true,
      },
    }),
    getPlatformSettings(),
  ]);

  const blockedAdvertiserIds = new Set(blockedAdvertisers.map((row) => row.advertiserId));
  const specialPayouts = readPublisherSpecialTierPayouts(publisherProfile);

  const campaigns = await prisma.campaign.findMany({
    where: { status: "ACTIVE" },
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

  const eligible = campaigns.filter((campaign) => {
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

  if (!publisherProfile?.restrictSmartLinkCampaigns) {
    return eligible;
  }

  const allowlist = await prisma.publisherSmartLinkCampaign.findMany({
    where: { publisherId },
    select: { campaignId: true },
  });
  return applySmartLinkCampaignAllowlist(
    eligible,
    allowlist.map((row) => row.campaignId),
  );
}

export async function pickNextCampaign(
  publisherId: string,
  options: { ip: string; countryCode?: string; userAgent?: string | null },
) {
  const smartLink = await prisma.publisherSmartLink.findUnique({ where: { publisherId } });
  if (!smartLink) {
    return {
      smartLink: null as PublisherSmartLink | null,
      trackingSlug: null as string | null,
      campaignLandingUrl: null as string | null,
      globalLinkUrl: await resolveGlobalLinkFallback(publisherId),
    };
  }

  const eligible = await getEligibleCampaigns(publisherId, { countryCode: options.countryCode });
  const countryEligible = filterCampaignsByCountry(eligible, options.countryCode);
  const { device, os } = parseUserAgent(options.userAgent);
  const pool = filterCampaignsByDeviceOs(countryEligible, { device, os });

  if (pool.length === 0) {
    return {
      smartLink,
      trackingSlug: null as string | null,
      campaignLandingUrl: null as string | null,
      globalLinkUrl: await resolveGlobalLinkFallback(publisherId),
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
      trackingSlug: null as string | null,
      campaignLandingUrl: null as string | null,
      globalLinkUrl: null,
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
    trackingSlug: trackingLink.slug,
    campaignLandingUrl: resolveCampaignLandingUrl(campaign.targeting, {
      trackingSlug: trackingLink.slug,
    }),
    globalLinkUrl: null,
  };
}

export { createTrackingLink };
