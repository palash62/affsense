import type { Prisma, PromotionEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import {
  buildPromotionUrl,
  normalizeAttributionForStorage,
  type PromotionAttributionPayload,
  type PromotionUtmFields,
  PROMO_VISIT_DEDUPE_SECONDS,
} from "@/lib/promotion-attribution";
import { buildPromotionVisitorKey } from "@/lib/promotion-attribution.server";

type RequestMeta = {
  ip: string;
  userAgent: string;
  referrer?: string | null;
};

function utmWhereFromFields(fields: PromotionUtmFields): Prisma.PromotionWhereInput {
  return {
    utmSource: fields.utmSource,
    utmMedium: fields.utmMedium,
    utmCampaign: fields.utmCampaign,
    utmContent: fields.utmContent,
    utmTerm: fields.utmTerm,
    isActive: true,
  };
}

export async function resolvePromotionIdByUtm(
  fields: Partial<PromotionUtmFields>,
): Promise<string | null> {
  const normalized = normalizeAttributionForStorage(fields);
  if (!normalized) return null;

  const promotion = await prisma.promotion.findFirst({
    where: utmWhereFromFields(normalized),
    select: { id: true },
  });
  return promotion?.id ?? null;
}

export async function recordPromotionClick(promotionId: string, meta: RequestMeta, origin: string) {
  const promotion = await prisma.promotion.findFirst({
    where: { id: promotionId, isActive: true },
  });
  if (!promotion) throw Errors.notFound("Promotion");

  const visitorKey = buildPromotionVisitorKey(meta.ip, meta.userAgent);
  await prisma.promotionEvent.create({
    data: {
      promotionId: promotion.id,
      eventType: "CLICK",
      utmSource: promotion.utmSource,
      utmMedium: promotion.utmMedium,
      utmCampaign: promotion.utmCampaign,
      utmContent: promotion.utmContent,
      utmTerm: promotion.utmTerm,
      landingPath: promotion.landingPath,
      landingUrl: buildPromotionUrl(origin, promotion),
      ip: meta.ip,
      userAgent: meta.userAgent,
      referrer: meta.referrer ?? null,
      visitorKey,
    },
  });

  return buildPromotionUrl(origin, promotion);
}

export async function recordPromotionVisit(
  body: Partial<PromotionAttributionPayload>,
  meta: RequestMeta,
): Promise<{ recorded: boolean }> {
  const normalized = normalizeAttributionForStorage(body);
  if (!normalized) return { recorded: false };

  const promotionId = await resolvePromotionIdByUtm(normalized);
  const visitorKey = buildPromotionVisitorKey(meta.ip, meta.userAgent);
  const since = new Date(Date.now() - PROMO_VISIT_DEDUPE_SECONDS * 1000);

  const recentDuplicate = await prisma.promotionEvent.findFirst({
    where: {
      eventType: "VISIT",
      visitorKey,
      createdAt: { gte: since },
      OR: [
        promotionId ? { promotionId } : undefined,
        {
          utmSource: normalized.utmSource,
          utmMedium: normalized.utmMedium,
          utmCampaign: normalized.utmCampaign,
          utmContent: normalized.utmContent,
          utmTerm: normalized.utmTerm,
        },
      ].filter(Boolean) as Prisma.PromotionEventWhereInput[],
    },
    select: { id: true },
  });

  if (recentDuplicate) return { recorded: false };

  await prisma.promotionEvent.create({
    data: {
      promotionId,
      eventType: "VISIT" as PromotionEventType,
      utmSource: normalized.utmSource,
      utmMedium: normalized.utmMedium,
      utmCampaign: normalized.utmCampaign,
      utmContent: normalized.utmContent,
      utmTerm: normalized.utmTerm,
      landingPath: normalized.landingPath ?? body.landingPath ?? null,
      landingUrl: normalized.landingUrl ?? body.landingUrl ?? null,
      ip: meta.ip,
      userAgent: meta.userAgent,
      referrer: meta.referrer ?? null,
      visitorKey,
    },
  });

  return { recorded: true };
}

export async function applySignupAttribution(
  input: Partial<PromotionAttributionPayload> | null | undefined,
): Promise<{
  promotionId: string | null;
  signupUtmSource: string | null;
  signupUtmMedium: string | null;
  signupUtmCampaign: string | null;
  signupUtmContent: string | null;
  signupUtmTerm: string | null;
  signupLandingUrl: string | null;
}> {
  const normalized = normalizeAttributionForStorage(input ?? {});
  if (!normalized) {
    return {
      promotionId: null,
      signupUtmSource: null,
      signupUtmMedium: null,
      signupUtmCampaign: null,
      signupUtmContent: null,
      signupUtmTerm: null,
      signupLandingUrl: null,
    };
  }

  const promotionId = await resolvePromotionIdByUtm(normalized);
  return {
    promotionId,
    signupUtmSource: normalized.utmSource,
    signupUtmMedium: normalized.utmMedium,
    signupUtmCampaign: normalized.utmCampaign,
    signupUtmContent: normalized.utmContent,
    signupUtmTerm: normalized.utmTerm,
    signupLandingUrl: normalized.landingUrl ?? null,
  };
}
