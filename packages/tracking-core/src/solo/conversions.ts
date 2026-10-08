import { prisma } from "@cpl/database";
import { dollarsToCents, isSoloProofAttribution, isWithinAttributionWindow } from "./attribution";
import { localDate } from "./pacing";
import { bumpSoloStats, isUniqueViolation, loadSoloAdsConfig } from "./store";

type SoloClickContext = {
  id: string;
  campaignId: string;
  providerId: string;
  publisherId: string;
  createdAt: Date;
  timezone: string;
  offerType: "CPA" | "DIGITAL";
  cpaOfferId: string | null;
  digitalProductId: string | null;
};

async function loadSoloClickContext(soloClickId: string): Promise<SoloClickContext | null> {
  const click = await prisma.soloClick.findUnique({
    where: { id: soloClickId },
    select: {
      id: true,
      campaignId: true,
      providerId: true,
      publisherId: true,
      createdAt: true,
      billingStatus: true,
      campaign: {
        select: { publisherId: true, timezone: true, offerType: true, cpaOfferId: true, digitalProductId: true },
      },
    },
  });
  if (!click?.campaignId || !click.campaign || !click.publisherId) return null;
  if (click.billingStatus === "INVALID" || click.billingStatus === "FALLBACK") return null;
  if (click.campaign.publisherId !== click.publisherId) return null;
  return {
    id: click.id,
    campaignId: click.campaignId,
    providerId: click.providerId,
    publisherId: click.publisherId,
    createdAt: click.createdAt,
    timezone: click.campaign.timezone,
    offerType: click.campaign.offerType,
    cpaOfferId: click.campaign.cpaOfferId,
    digitalProductId: click.campaign.digitalProductId,
  };
}

async function insertConversion(
  ctx: SoloClickContext,
  data: {
    source: "CPA" | "DIGITAL";
    dedupeKey: string;
    commissionCents: number;
    status: "PENDING" | "APPROVED";
    cpaOfferConversionId?: string | null;
    webhookEventId?: string | null;
    externalTxnId?: string | null;
    isRecurring?: boolean;
    assisted?: boolean;
    at: Date;
  },
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.soloConversion.create({
        data: {
          soloClickId: ctx.id,
          campaignId: ctx.campaignId,
          providerId: ctx.providerId,
          publisherId: ctx.publisherId,
          source: data.source,
          dedupeKey: data.dedupeKey.slice(0, 191),
          cpaOfferConversionId: data.cpaOfferConversionId ?? null,
          webhookEventId: data.webhookEventId ?? null,
          externalTxnId: data.externalTxnId?.slice(0, 191) ?? null,
          commissionCents: data.commissionCents,
          status: data.status,
          isRecurring: data.isRecurring ?? false,
          assisted: data.assisted ?? false,
        },
      });
      await bumpSoloStats(
        tx,
        { campaignId: ctx.campaignId, providerId: ctx.providerId, localDate: localDate(data.at, ctx.timezone) },
        { conversions: 1, commissionCents: data.commissionCents },
      );
      return row;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

/**
 * Credit a verified CPA conversion (authenticated postback) to the Solo
 * campaign whose click created the offer click. One conversion per
 * transaction id, or one per click when the network sends no transaction id.
 */
export async function recordSoloCpaConversion(input: {
  cpaOfferConversionId: string;
  clickRecordId: string | null;
  offerId: string;
  publisherPayout: number | string | { toString(): string } | null;
  transactionId?: string | null;
  at?: Date;
}) {
  if (!input.clickRecordId) return null;
  const offerClick = await prisma.cpaOfferClick.findUnique({
    where: { id: input.clickRecordId },
    select: { soloClickId: true, publisherId: true, offerId: true },
  });
  if (!offerClick?.soloClickId || offerClick.offerId !== input.offerId) return null;
  const ctx = await loadSoloClickContext(offerClick.soloClickId);
  if (!ctx || ctx.offerType !== "CPA" || ctx.cpaOfferId !== input.offerId) return null;
  if (offerClick.publisherId !== ctx.publisherId) return null;

  const at = input.at ?? new Date();
  const config = await loadSoloAdsConfig();
  if (!isWithinAttributionWindow(ctx.createdAt, at, config.attributionWindowDays)) return null;

  const txn = input.transactionId?.trim() || null;
  return insertConversion(ctx, {
    source: "CPA",
    dedupeKey: txn ? `cpa:${input.offerId}:${txn}` : `cpa:click:${ctx.id}`,
    commissionCents: dollarsToCents(input.publisherPayout),
    status: config.cpaApprovalDays === 0 ? "APPROVED" : "PENDING",
    cpaOfferConversionId: input.cpaOfferConversionId,
    externalTxnId: txn,
    at,
  });
}

function isRefundEvent(externalEventKey: string | null): boolean {
  return (externalEventKey ?? "").startsWith("cf:refund:");
}

/**
 * Sync a processed ClickFunnels event with Solo Ads: a sale with exact click
 * proof (or a rebill of a Solo-attributed subscription) creates a conversion;
 * a refund reverses the matching sale's conversion.
 */
export async function syncSoloDigitalConversion(webhookEventId: string) {
  const event = await prisma.webhookEvent.findUnique({
    where: { id: webhookEventId },
    select: {
      id: true,
      status: true,
      publisherId: true,
      clickId: true,
      digitalProductId: true,
      commissionAmount: true,
      attributionMethod: true,
      externalEventKey: true,
      isRecurring: true,
      cfOrderId: true,
      cfProductId: true,
      cfSubscriptionId: true,
      createdAt: true,
    },
  });
  if (!event || event.status !== "PROCESSED" || !event.publisherId || !event.digitalProductId) return null;

  if (isRefundEvent(event.externalEventKey)) {
    if (!event.cfOrderId) return null;
    const sale = await prisma.webhookEvent.findFirst({
      where: {
        id: { not: event.id },
        status: "PROCESSED",
        publisherId: event.publisherId,
        digitalProductId: event.digitalProductId,
        cfOrderId: event.cfOrderId,
        cfProductId: event.cfProductId,
        NOT: { externalEventKey: { startsWith: "cf:refund:" } },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return sale ? reverseSoloConversionForWebhookEvent(sale.id, "refund") : null;
  }

  if (!isSoloProofAttribution(event.attributionMethod)) return null;

  let soloClickId: string | null = null;
  let assisted = false;
  if (event.attributionMethod === "exact_click") {
    if (!event.clickId) return null;
    const click = await prisma.digitalProductClick.findUnique({
      where: { id: event.clickId },
      select: { soloClickId: true, publisherId: true, productId: true },
    });
    if (!click?.soloClickId || click.publisherId !== event.publisherId || click.productId !== event.digitalProductId) {
      return null;
    }
    soloClickId = click.soloClickId;
  } else {
    // Rebill: inherit the original verified purchase, never the latest click.
    if (!event.cfSubscriptionId) return null;
    const sub = await prisma.digitalProductSubscriptionAttribution.findUnique({
      where: { cfSubscriptionId: event.cfSubscriptionId },
      select: { originalWebhookEventId: true, publisherId: true, productId: true },
    });
    if (!sub?.originalWebhookEventId || sub.publisherId !== event.publisherId || sub.productId !== event.digitalProductId) {
      return null;
    }
    const original = await prisma.soloConversion.findFirst({
      where: { webhookEventId: sub.originalWebhookEventId, status: { not: "REVERSED" } },
      select: { soloClickId: true },
    });
    if (!original) return null;
    soloClickId = original.soloClickId;
    assisted = true;
  }

  const ctx = await loadSoloClickContext(soloClickId);
  if (!ctx || ctx.offerType !== "DIGITAL" || ctx.digitalProductId !== event.digitalProductId) return null;
  if (ctx.publisherId !== event.publisherId) return null;
  if (event.attributionMethod === "exact_click") {
    const config = await loadSoloAdsConfig();
    if (!isWithinAttributionWindow(ctx.createdAt, event.createdAt, config.attributionWindowDays)) return null;
  }

  return insertConversion(ctx, {
    source: "DIGITAL",
    dedupeKey: `dp:${event.id}`,
    commissionCents: dollarsToCents(event.commissionAmount),
    status: "APPROVED",
    webhookEventId: event.id,
    externalTxnId: event.cfOrderId,
    isRecurring: event.isRecurring,
    assisted,
    at: event.createdAt,
  });
}

/** Mark the Solo conversion of a sale event as reversed (refund, chargeback, admin reject). */
export async function reverseSoloConversionForWebhookEvent(webhookEventId: string, reason: string) {
  const conversion = await prisma.soloConversion.findFirst({
    where: { webhookEventId, status: { not: "REVERSED" } },
    select: { id: true },
  });
  return conversion ? reverseSoloConversion(conversion.id, reason) : null;
}

export async function reverseSoloConversion(conversionId: string, reason: string, at = new Date()) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.soloConversion.findUnique({
      where: { id: conversionId },
      select: {
        id: true,
        status: true,
        campaignId: true,
        providerId: true,
        commissionCents: true,
        createdAt: true,
        campaign: { select: { timezone: true } },
      },
    });
    if (!row || row.status === "REVERSED") return null;
    const flipped = await tx.soloConversion.updateMany({
      where: { id: row.id, status: { not: "REVERSED" } },
      data: { status: "REVERSED", reversedAt: at, reverseReason: reason.slice(0, 191) },
    });
    if (flipped.count !== 1) return null;
    await bumpSoloStats(
      tx,
      {
        campaignId: row.campaignId,
        providerId: row.providerId,
        localDate: localDate(row.createdAt, row.campaign.timezone),
      },
      { reversedCents: row.commissionCents },
    );
    return row.id;
  });
}

/** Approve CPA conversions whose hold period has passed. */
export async function approveMaturedSoloConversions(holdDays: number, now = new Date()) {
  const cutoff = new Date(now.getTime() - holdDays * 24 * 60 * 60 * 1000);
  const result = await prisma.soloConversion.updateMany({
    where: { status: "PENDING", createdAt: { lte: cutoff } },
    data: { status: "APPROVED" },
  });
  return result.count;
}
