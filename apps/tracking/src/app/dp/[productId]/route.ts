import { prisma } from "@cpl/database";
import { readSubIds, sanitizeTrackingParam } from "@cpl/shared";
import { NextResponse } from "next/server";
import { findActivePublisherByRef } from "@/lib/member-ref";
import {
  buildDigitalProductDestination,
  clientIp,
  createDigitalProductPublisherClick,
} from "@/lib/offer-clicks";
import { SOLO_CLICK_PARAM, findLinkedDigitalProductClick, resolveSoloClickLink } from "@/lib/solo-link";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const product = await prisma.digitalProduct.findUnique({
    where: { id: productId },
    select: {
      id: true,
      status: true,
      salesPageUrl: true,
      affiliateTrackingParam: true,
      isPrivate: true,
    },
  });

  if (!product) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  if (product.status !== "ACTIVE") {
    return NextResponse.json({ error: { code: "GONE" } }, { status: 410 });
  }

  const requestUrl = new URL(request.url);
  const pageId = requestUrl.searchParams.get("page")?.trim() || null;
  const salesPage = pageId
    ? await prisma.digitalProductSalesPage.findFirst({
        where: { id: pageId, productId: product.id },
        select: { id: true, pageUrl: true },
      })
    : null;
  const salesPageUrl = salesPage?.pageUrl?.trim() || product.salesPageUrl?.trim() || null;

  if (!salesPageUrl) {
    return NextResponse.json(
      { error: { code: "GONE", message: "Sales page URL is not configured" } },
      { status: 410 },
    );
  }

  const pubId = requestUrl.searchParams.get("pub_id")?.trim() || null;
  const src = sanitizeTrackingParam(requestUrl.searchParams.get("src")) ?? null;
  const rawSubIds = readSubIds(requestUrl.searchParams);
  const subIds = {
    sub1: sanitizeTrackingParam(rawSubIds.sub1) ?? null,
    sub2: sanitizeTrackingParam(rawSubIds.sub2) ?? null,
    sub3: sanitizeTrackingParam(rawSubIds.sub3) ?? null,
    sub4: sanitizeTrackingParam(rawSubIds.sub4) ?? null,
  };
  const campaign = sanitizeTrackingParam(requestUrl.searchParams.get("campaign")) ?? null;

  if (!pubId) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "pub_id is required" } },
      { status: 400 },
    );
  }

  const publisher = await findActivePublisherByRef(pubId);

  if (!publisher) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Invalid publisher" } },
      { status: 403 },
    );
  }

  if (product.isPrivate) {
    const allowed = await prisma.digitalProductAllowedPublisher.findUnique({
      where: { productId_publisherId: { productId: product.id, publisherId: publisher.id } },
      select: { id: true },
    });
    if (!allowed) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access not approved for this product" } },
        { status: 403 },
      );
    }
  }

  let clickId: string | undefined;
  try {
    const soloClickId = await resolveSoloClickLink({
      rawId: requestUrl.searchParams.get(SOLO_CLICK_PARAM),
      publisherId: publisher.id,
      offerType: "DIGITAL",
      offerId: product.id,
    });
    const existing = soloClickId ? await findLinkedDigitalProductClick(soloClickId) : null;
    if (existing) {
      clickId = existing.id;
    } else {
      const click = await createDigitalProductPublisherClick(prisma, {
        productId: product.id,
        publisherId: publisher.id,
        salesPageId: salesPage?.pageUrl?.trim() ? salesPage.id : null,
        subIds,
        src,
        campaign,
        visitor: { ip: clientIp(request), userAgent: request.headers.get("user-agent") },
        soloClickId,
      });
      clickId = click.id;
    }
  } catch {
    // Best-effort: still redirect even if click write fails.
  }

  const destination = buildDigitalProductDestination({
    salesPageUrl,
    affiliateTrackingParam: product.affiliateTrackingParam,
    memberNo: publisher.memberNo,
    subIds,
    src,
    campaign,
    clickId,
  });

  if (!destination) {
    return NextResponse.json({ error: { code: "GONE" } }, { status: 410 });
  }

  return NextResponse.redirect(destination, 302);
}
