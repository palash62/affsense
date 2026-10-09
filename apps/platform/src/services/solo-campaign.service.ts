import {
  assertSoloDestinationSafe,
  cpcCentsForTraffic,
  providerCostCentsForTraffic,
  isValidTimeZone,
  loadSoloAdsConfig,
  SOLO_DEVICES,
  zonedInputToUtc,
} from "@cpl/tracking-core";
import type { Prisma, SoloOfferType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError, Errors } from "@/lib/errors";

const TRACKING_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

const centsField = z.coerce.number().finite().positive().transform((v) => Math.round(v * 100));

export const soloCampaignInputSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(120),
  offerType: z.enum(["CPA", "DIGITAL"]),
  offerId: z.string().trim().min(1, "Choose an offer"),
  trafficType: z.enum(["REGULAR", "WARM"]),
  destinationMode: z.enum(["DIRECT", "EXTERNAL"]),
  destinationUrl: z.string().trim().max(2000).optional().nullable(),
  countries: z.array(z.string().trim().toUpperCase().length(2)).min(1, "Choose at least one country"),
  devices: z.array(z.enum(SOLO_DEVICES as unknown as [string, ...string[]])).optional().default([]),
  activeHours: z.array(z.number().int().min(0).max(23)).optional().default([]),
  timezone: z.string().trim().optional(),
  /** "YYYY-MM-DDTHH:mm" in the campaign timezone, or an ISO instant. */
  startAt: z.union([z.string().trim(), z.date()]).optional().nullable(),
  endAt: z.union([z.string().trim(), z.date()]).optional().nullable(),
  dailyBudget: centsField,
  lifetimeBudget: centsField,
});

export type SoloCampaignInput = z.input<typeof soloCampaignInputSchema>;

function parseInput(raw: unknown, partial = false) {
  const schema = partial ? soloCampaignInputSchema.partial() : soloCampaignInputSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw Errors.validation(issue?.message ?? "Invalid campaign", issue?.path?.join("."));
  }
  return parsed.data as Partial<z.output<typeof soloCampaignInputSchema>>;
}

// ---------------------------------------------------------------- offers

export type SoloOfferOption = { type: SoloOfferType; id: string; name: string; payoutLabel: string | null };

export async function listSoloEligibleOffers(publisherId: string): Promise<SoloOfferOption[]> {
  const [cpa, digital] = await Promise.all([
    prisma.cpaOffer.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ visibility: "PUBLIC" }, { publisherAccessRequests: { some: { publisherId, status: "APPROVED" } } }],
      },
      select: { id: true, name: true, payout: true },
      orderBy: { name: "asc" },
    }),
    prisma.digitalProduct.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ isPrivate: false }, { allowedPublishers: { some: { publisherId } } }],
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return [
    ...cpa.map((o) => ({
      type: "CPA" as const,
      id: o.id,
      name: o.name,
      payoutLabel: `$${Number(o.payout).toFixed(2)} per conversion`,
    })),
    ...digital.map((p) => ({ type: "DIGITAL" as const, id: p.id, name: p.name, payoutLabel: null })),
  ];
}

export async function assertSoloOfferAuthorized(publisherId: string, offerType: SoloOfferType, offerId: string) {
  if (offerType === "CPA") {
    const offer = await prisma.cpaOffer.findUnique({ where: { id: offerId }, select: { status: true, visibility: true } });
    if (!offer || offer.status !== "ACTIVE") throw Errors.validation("This offer is not available", "offerId");
    if (offer.visibility !== "PUBLIC") {
      const access = await prisma.publisherCpaOfferAccess.findUnique({
        where: { publisherId_offerId: { publisherId, offerId } },
        select: { status: true },
      });
      if (access?.status !== "APPROVED") throw Errors.validation("You are not approved for this offer", "offerId");
    }
    return;
  }
  const product = await prisma.digitalProduct.findUnique({ where: { id: offerId }, select: { status: true, isPrivate: true } });
  if (!product || product.status !== "ACTIVE") throw Errors.validation("This product is not available", "offerId");
  if (product.isPrivate) {
    const allowed = await prisma.digitalProductAllowedPublisher.findUnique({
      where: { productId_publisherId: { productId: offerId, publisherId } },
      select: { id: true },
    });
    if (!allowed) throw Errors.validation("You are not approved for this product", "offerId");
  }
}

// ---------------------------------------------------------------- validation

async function isHostVerified(publisherId: string, host: string) {
  const row = await prisma.soloTrackingHost.findFirst({
    where: { host, site: { publisherId }, lastSeenAt: { gte: new Date(Date.now() - TRACKING_FRESH_MS) } },
    select: { id: true },
  });
  return Boolean(row);
}

function toInstant(value: string | Date | null | undefined, timeZone: string, field: string): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const local = zonedInputToUtc(value, timeZone);
  const date = local ?? new Date(value);
  if (Number.isNaN(date.getTime())) throw Errors.validation("Enter a valid date", field);
  return date;
}

type Normalized = {
  name: string;
  offerType: SoloOfferType;
  cpaOfferId: string | null;
  digitalProductId: string | null;
  trafficType: "REGULAR" | "WARM";
  destinationMode: "DIRECT" | "EXTERNAL";
  destinationUrl: string | null;
  destinationHost: string | null;
  countries: string[];
  devices: string[];
  activeHours: number[];
  timezone: string;
  startAt: Date | null;
  endAt: Date | null;
  dailyBudgetCents: number;
  lifetimeBudgetCents: number;
};

async function normalize(publisherId: string, input: z.output<typeof soloCampaignInputSchema>, spentCents = 0): Promise<Normalized> {
  const config = await loadSoloAdsConfig();
  const countries = [...new Set(input.countries)];
  const unsupported = countries.filter((c) => !config.supportedCountries.includes(c));
  if (unsupported.length) throw Errors.validation(`Not supported yet: ${unsupported.join(", ")}`, "countries");

  const timezone = input.timezone || config.defaultTimezone;
  if (!isValidTimeZone(timezone)) throw Errors.validation("Choose a valid timezone", "timezone");
  const startAt = toInstant(input.startAt, timezone, "startAt");
  const endAt = toInstant(input.endAt, timezone, "endAt");
  if (startAt && endAt && endAt <= startAt) {
    throw Errors.validation("The end date must be after the start date", "endAt");
  }
  if (input.dailyBudget < config.minDailyBudgetCents || input.dailyBudget > config.maxDailyBudgetCents) {
    throw Errors.validation(
      `Daily budget must be between $${(config.minDailyBudgetCents / 100).toFixed(2)} and $${(config.maxDailyBudgetCents / 100).toFixed(2)}`,
      "dailyBudget",
    );
  }
  if (input.lifetimeBudget < input.dailyBudget) throw Errors.validation("Total budget must be at least the daily budget", "lifetimeBudget");
  if (input.lifetimeBudget < spentCents) throw Errors.validation("Total budget cannot be lower than what is already spent", "lifetimeBudget");

  await assertSoloOfferAuthorized(publisherId, input.offerType, input.offerId);

  let destinationUrl: string | null = null;
  let destinationHost: string | null = null;
  if (input.destinationMode === "EXTERNAL") {
    if (!input.destinationUrl) throw Errors.validation("Enter your landing page URL", "destinationUrl");
    try {
      const safe = await assertSoloDestinationSafe(input.destinationUrl);
      destinationUrl = safe.url;
      destinationHost = safe.host;
    } catch (error) {
      throw Errors.validation((error as Error).message || "This URL is not allowed", "destinationUrl");
    }
  }

  return {
    name: input.name,
    offerType: input.offerType,
    cpaOfferId: input.offerType === "CPA" ? input.offerId : null,
    digitalProductId: input.offerType === "DIGITAL" ? input.offerId : null,
    trafficType: input.trafficType,
    destinationMode: input.destinationMode,
    destinationUrl,
    destinationHost,
    countries,
    devices: [...new Set(input.devices ?? [])],
    activeHours: [...new Set(input.activeHours ?? [])].sort((a, b) => a - b),
    timezone,
    startAt,
    endAt,
    dailyBudgetCents: input.dailyBudget,
    lifetimeBudgetCents: input.lifetimeBudget,
  };
}

// ---------------------------------------------------------------- CRUD

const OFFER_SELECT = {
  cpaOffer: { select: { id: true, name: true, status: true } },
  digitalProduct: { select: { id: true, name: true, status: true } },
} as const;

/** Provider cost is the platform's own cost; publisher responses never include it. */
const PUBLISHER_OMIT = { providerCostCentsSnapshot: true } as const;

export async function getOwnedSoloCampaign(publisherId: string, campaignId: string) {
  const campaign = await prisma.soloCampaign.findUnique({ where: { id: campaignId }, include: OFFER_SELECT, omit: PUBLISHER_OMIT });
  if (!campaign) throw Errors.notFound("Campaign");
  if (campaign.publisherId !== publisherId) throw Errors.forbidden();
  return campaign;
}

export async function listSoloCampaigns(publisherId: string) {
  return prisma.soloCampaign.findMany({
    where: { publisherId },
    orderBy: { createdAt: "desc" },
    include: OFFER_SELECT,
    omit: PUBLISHER_OMIT,
  });
}

export async function createSoloCampaign(publisherId: string, raw: unknown) {
  const input = parseInput(raw) as z.output<typeof soloCampaignInputSchema>;
  const data = await normalize(publisherId, input);
  const config = await loadSoloAdsConfig();
  const verified = data.destinationHost ? await isHostVerified(publisherId, data.destinationHost) : false;
  return prisma.soloCampaign.create({
    data: {
      ...data,
      publisherId,
      cpcCentsSnapshot: cpcCentsForTraffic(config, data.trafficType),
      providerCostCentsSnapshot: providerCostCentsForTraffic(config, data.trafficType),
      trackingVerifiedAt: verified ? new Date() : null,
      status: "DRAFT",
    },
    omit: PUBLISHER_OMIT,
  });
}

const MATERIAL_FIELDS: Array<keyof Normalized> = [
  "offerType",
  "cpaOfferId",
  "digitalProductId",
  "trafficType",
  "destinationMode",
  "destinationUrl",
  "countries",
];

const REVIEWED_STATUSES = ["ACTIVE", "PAUSED", "BUDGET_EXHAUSTED", "INSUFFICIENT_FUNDS"];

export async function updateSoloCampaign(publisherId: string, campaignId: string, raw: unknown) {
  const existing = await getOwnedSoloCampaign(publisherId, campaignId);
  if (existing.status === "COMPLETED") throw Errors.validation("Completed campaigns cannot be edited");

  const patch = parseInput(raw, true);
  const merged = {
    name: existing.name,
    offerType: existing.offerType,
    offerId: (existing.cpaOfferId ?? existing.digitalProductId) as string,
    trafficType: existing.trafficType,
    destinationMode: existing.destinationMode,
    destinationUrl: existing.destinationUrl,
    countries: existing.countries as string[],
    devices: (existing.devices as string[] | null) ?? [],
    activeHours: (existing.activeHours as number[] | null) ?? [],
    timezone: existing.timezone,
    startAt: existing.startAt,
    endAt: existing.endAt,
    dailyBudget: existing.dailyBudgetCents,
    lifetimeBudget: existing.lifetimeBudgetCents,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
  } as z.output<typeof soloCampaignInputSchema>;

  const data = await normalize(publisherId, merged, existing.spentCents + existing.reservedCents);
  const changed = MATERIAL_FIELDS.filter(
    (k) => JSON.stringify(data[k]) !== JSON.stringify(existing[k as keyof typeof existing]),
  );
  const update: Prisma.SoloCampaignUpdateInput = { ...data };

  if (data.trafficType !== existing.trafficType) {
    const config = await loadSoloAdsConfig();
    update.cpcCentsSnapshot = cpcCentsForTraffic(config, data.trafficType);
    update.providerCostCentsSnapshot = providerCostCentsForTraffic(config, data.trafficType);
  }
  if (data.destinationHost !== existing.destinationHost) {
    update.trackingVerifiedAt =
      data.destinationHost && (await isHostVerified(publisherId, data.destinationHost)) ? new Date() : null;
  }
  if (changed.length && REVIEWED_STATUSES.includes(existing.status)) {
    update.status = "PENDING_REVIEW";
    update.statusReason = `Re-review after changes to: ${changed.join(", ")}`;
    update.submittedAt = new Date();
  } else if (
    existing.status === "BUDGET_EXHAUSTED" &&
    data.lifetimeBudgetCents > existing.spentCents + existing.reservedCents
  ) {
    update.status = "ACTIVE";
    update.statusReason = null;
  }

  return prisma.soloCampaign.update({ where: { id: campaignId }, data: update, omit: PUBLISHER_OMIT });
}

export type SoloCampaignAction = "submit" | "pause" | "resume";

export async function changeSoloCampaignStatus(publisherId: string, campaignId: string, action: SoloCampaignAction) {
  const campaign = await getOwnedSoloCampaign(publisherId, campaignId);
  const adminPaused = campaign.status === "PAUSED" && campaign.statusReason?.startsWith("Paused by Affsense");

  if (action === "submit") {
    if (!["DRAFT", "REJECTED"].includes(campaign.status)) throw Errors.validation("This campaign was already submitted");
    await assertSoloOfferAuthorized(publisherId, campaign.offerType, (campaign.cpaOfferId ?? campaign.digitalProductId)!);
    return prisma.soloCampaign.update({
      where: { id: campaignId },
      data: { status: "PENDING_REVIEW", statusReason: null, submittedAt: new Date() },
      omit: PUBLISHER_OMIT,
    });
  }
  if (action === "pause") {
    if (!["ACTIVE", "INSUFFICIENT_FUNDS", "BUDGET_EXHAUSTED"].includes(campaign.status)) {
      throw Errors.validation("Only running campaigns can be paused");
    }
    return prisma.soloCampaign.update({ where: { id: campaignId }, data: { status: "PAUSED", statusReason: "Paused by you" }, omit: PUBLISHER_OMIT });
  }
  if (campaign.status !== "PAUSED") throw Errors.validation("Only paused campaigns can be resumed");
  if (adminPaused) throw new AppError("ADMIN_PAUSED", "This campaign was paused by Affsense. Contact support to resume it.", 403);
  return prisma.soloCampaign.update({ where: { id: campaignId }, data: { status: "ACTIVE", statusReason: null }, omit: PUBLISHER_OMIT });
}

export async function deleteSoloCampaign(publisherId: string, campaignId: string) {
  const campaign = await getOwnedSoloCampaign(publisherId, campaignId);
  if (campaign.status !== "DRAFT") throw Errors.validation("Only drafts can be deleted. Pause the campaign instead.");
  await prisma.soloCampaign.delete({ where: { id: campaignId } });
}

// ---------------------------------------------------------------- providers (anonymized)

export async function listSoloCampaignProviders(publisherId: string, campaignId: string) {
  const campaign = await getOwnedSoloCampaign(publisherId, campaignId);
  const [providers, blocks, stats] = await Promise.all([
    prisma.soloProvider.findMany({
      where: {
        status: { not: "DISABLED" },
        trafficClass: { in: campaign.trafficType === "WARM" ? ["WARM", "BOTH"] : ["REGULAR", "BOTH"] },
      },
      select: { id: true, publicCode: true },
      orderBy: { publicCode: "asc" },
    }),
    prisma.soloCampaignProviderBlock.findMany({ where: { campaignId }, select: { providerId: true } }),
    prisma.soloDailyStats.groupBy({
      by: ["providerId"],
      where: { campaignId },
      _sum: { billedClicks: true, spendCents: true, leads: true, conversions: true, commissionCents: true, reversedCents: true },
    }),
  ]);
  const blocked = new Set(blocks.map((b) => b.providerId));
  return providers.map((p) => {
    const s = stats.find((row) => row.providerId === p.id)?._sum;
    return {
      publicCode: p.publicCode,
      blocked: blocked.has(p.id),
      clicks: s?.billedClicks ?? 0,
      spendCents: s?.spendCents ?? 0,
      leads: s?.leads ?? 0,
      conversions: s?.conversions ?? 0,
      commissionCents: (s?.commissionCents ?? 0) - (s?.reversedCents ?? 0),
    };
  });
}

export async function setSoloProviderBlock(publisherId: string, campaignId: string, publicCode: number, blocked: boolean) {
  await getOwnedSoloCampaign(publisherId, campaignId);
  const provider = await prisma.soloProvider.findUnique({ where: { publicCode }, select: { id: true } });
  if (!provider) throw Errors.notFound("Provider");
  if (blocked) {
    await prisma.soloCampaignProviderBlock.upsert({
      where: { campaignId_providerId: { campaignId, providerId: provider.id } },
      create: { campaignId, providerId: provider.id, actorId: publisherId },
      update: {},
    });
  } else {
    await prisma.soloCampaignProviderBlock.deleteMany({ where: { campaignId, providerId: provider.id } });
  }
  return { publicCode, blocked };
}
