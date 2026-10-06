import { prisma } from "@cpl/database";
import {
  buildDigitalProductDestinationUrl,
  formatMemberId,
  readSubIds,
  sanitizeTrackingParam,
} from "@cpl/shared";
import { NextResponse } from "next/server";
import { findActivePublisherByRef } from "@/lib/member-ref";

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

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
  const src = sanitizeTrackingParam(requestUrl.searchParams.get("src"));
  const rawSubIds = readSubIds(requestUrl.searchParams);
  const subId = sanitizeTrackingParam(rawSubIds.sub1);
  const subId2 = sanitizeTrackingParam(rawSubIds.sub2);
  const subId3 = sanitizeTrackingParam(rawSubIds.sub3);
  const subId4 = sanitizeTrackingParam(rawSubIds.sub4);
  const campaign = sanitizeTrackingParam(requestUrl.searchParams.get("campaign"));

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
    const click = await prisma.digitalProductClick.create({
      data: {
        productId: product.id,
        publisherId: publisher.id,
        salesPageId: salesPage?.pageUrl?.trim() ? salesPage.id : null,
        src: src?.slice(0, 191) || null,
        subId: subId?.slice(0, 191) || null,
        subId2: subId2?.slice(0, 191) || null,
        subId3: subId3?.slice(0, 191) || null,
        subId4: subId4?.slice(0, 191) || null,
        campaign: campaign?.slice(0, 191) || null,
        ip: clientIp(request)?.slice(0, 191) || null,
        userAgent: request.headers.get("user-agent")?.slice(0, 1000) || null,
      },
      select: { id: true },
    });
    clickId = click.id;
  } catch {
    // Best-effort: still redirect even if click write fails.
  }

  const destination = buildDigitalProductDestinationUrl(
    salesPageUrl,
    product.affiliateTrackingParam,
    formatMemberId(publisher.memberNo),
    {
      source: src,
      subid: subId,
      subid2: subId2,
      subid3: subId3,
      subid4: subId4,
      campaign,
      clickId,
    },
  );

  if (!destination) {
    return NextResponse.json({ error: { code: "GONE" } }, { status: 410 });
  }

  return NextResponse.redirect(destination, 302);
}
