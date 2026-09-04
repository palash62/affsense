import { prisma } from "@cpl/database";
import {
  buildDigitalProductDestinationUrl,
  sanitizeTrackingParam,
} from "@cpl/shared";
import { NextResponse } from "next/server";

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
    },
  });

  if (!product) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  if (product.status !== "ACTIVE") {
    return NextResponse.json({ error: { code: "GONE" } }, { status: 410 });
  }

  if (!product.salesPageUrl?.trim()) {
    return NextResponse.json(
      { error: { code: "GONE", message: "Sales page URL is not configured" } },
      { status: 410 },
    );
  }

  const requestUrl = new URL(request.url);
  const pubId = requestUrl.searchParams.get("pub_id")?.trim() || null;
  const src = sanitizeTrackingParam(requestUrl.searchParams.get("src"));
  const subId = sanitizeTrackingParam(requestUrl.searchParams.get("sub_id"));
  const campaign = sanitizeTrackingParam(requestUrl.searchParams.get("campaign"));

  if (!pubId) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "pub_id is required" } },
      { status: 400 },
    );
  }

  const publisher = await prisma.user.findFirst({
    where: { id: pubId, role: "PUBLISHER", status: "ACTIVE" },
    select: { id: true },
  });

  if (!publisher) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Invalid publisher" } },
      { status: 403 },
    );
  }

  const destination = buildDigitalProductDestinationUrl(
    product.salesPageUrl,
    product.affiliateTrackingParam,
    publisher.id,
    {
      source: src,
      subid: subId,
      campaign,
    },
  );

  if (!destination) {
    return NextResponse.json({ error: { code: "GONE" } }, { status: 410 });
  }

  return NextResponse.redirect(destination, 302);
}
