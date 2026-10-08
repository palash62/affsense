import { prisma } from "@cpl/database";
import type { Prisma } from "@prisma/client";
import {
  buildDigitalProductDestinationUrl,
  formatMemberId,
  injectClickIdIntoTrackingUrl,
  type TrackingSubIds,
} from "@cpl/shared";

type Db = Prisma.TransactionClient | typeof prisma;

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

export type ClickVisitor = { ip: string | null; userAgent: string | null };

const cut = (value: string | null | undefined, max = 191) => value?.slice(0, max) || null;

/** Offer tracking URL with click id macros filled and affiliate params appended. */
export function buildCpaOfferDestination(input: {
  trackingUrl: string;
  clickId: string | null;
  origin: string;
  advId?: string | null;
  pubId?: string | null;
  subIds: TrackingSubIds;
  src: string | null;
}): string {
  let destination = input.trackingUrl;
  // Replace {click_id} macros before URL serialization encodes braces to %7B...%7D.
  if (input.clickId) {
    destination = injectClickIdIntoTrackingUrl(destination, input.clickId, input.origin);
  }
  try {
    const target = destination.startsWith("/") ? new URL(destination, input.origin) : new URL(destination);
    if (input.advId) target.searchParams.set("adv_id", input.advId);
    if (input.pubId) target.searchParams.set("pub_id", input.pubId);
    if (input.subIds.sub1) {
      target.searchParams.set("sub_id", input.subIds.sub1);
      target.searchParams.set("sub1", input.subIds.sub1);
    }
    if (input.subIds.sub2) target.searchParams.set("sub2", input.subIds.sub2);
    if (input.subIds.sub3) target.searchParams.set("sub3", input.subIds.sub3);
    if (input.subIds.sub4) target.searchParams.set("sub4", input.subIds.sub4);
    if (input.src) target.searchParams.set("src", input.src);
    destination = target.toString();
  } catch {
    // keep original destination
  }
  return destination;
}

export async function createCpaPublisherClick(
  db: Db,
  input: {
    offerId: string;
    publisherId: string;
    subIds: TrackingSubIds;
    src: string | null;
    visitor: ClickVisitor;
    soloClickId?: string | null;
  },
) {
  return db.cpaOfferClick.create({
    data: {
      offerId: input.offerId,
      publisherId: input.publisherId,
      subId: cut(input.subIds.sub1),
      subId2: cut(input.subIds.sub2),
      subId3: cut(input.subIds.sub3),
      subId4: cut(input.subIds.sub4),
      src: cut(input.src),
      ip: cut(input.visitor.ip),
      userAgent: cut(input.visitor.userAgent, 1000),
      soloClickId: input.soloClickId ?? null,
    },
    select: { id: true },
  });
}

export async function createDigitalProductPublisherClick(
  db: Db,
  input: {
    productId: string;
    publisherId: string;
    salesPageId: string | null;
    subIds: TrackingSubIds;
    src: string | null;
    campaign: string | null;
    visitor: ClickVisitor;
    soloClickId?: string | null;
  },
) {
  return db.digitalProductClick.create({
    data: {
      productId: input.productId,
      publisherId: input.publisherId,
      salesPageId: input.salesPageId,
      src: cut(input.src),
      subId: cut(input.subIds.sub1),
      subId2: cut(input.subIds.sub2),
      subId3: cut(input.subIds.sub3),
      subId4: cut(input.subIds.sub4),
      campaign: cut(input.campaign),
      ip: cut(input.visitor.ip),
      userAgent: cut(input.visitor.userAgent, 1000),
      soloClickId: input.soloClickId ?? null,
    },
    select: { id: true },
  });
}

export function buildDigitalProductDestination(input: {
  salesPageUrl: string;
  affiliateTrackingParam: string | null;
  memberNo: number;
  subIds: TrackingSubIds;
  src: string | null;
  campaign: string | null;
  clickId?: string;
}) {
  return buildDigitalProductDestinationUrl(
    input.salesPageUrl,
    input.affiliateTrackingParam,
    formatMemberId(input.memberNo),
    {
      source: input.src ?? undefined,
      subid: input.subIds.sub1 ?? undefined,
      subid2: input.subIds.sub2 ?? undefined,
      subid3: input.subIds.sub3 ?? undefined,
      subid4: input.subIds.sub4 ?? undefined,
      campaign: input.campaign ?? undefined,
      clickId: input.clickId,
    },
  );
}
