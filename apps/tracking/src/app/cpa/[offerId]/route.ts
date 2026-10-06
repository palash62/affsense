import { prisma } from "@cpl/database";
import { injectClickIdIntoTrackingUrl, readSubIds } from "@cpl/shared";
import { NextResponse } from "next/server";
import { findActivePublisherByRef } from "@/lib/member-ref";

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> },
) {
  const { offerId } = await params;
  const offer = await prisma.cpaOffer.findUnique({
    where: { id: offerId },
    select: { id: true, status: true, trackingUrl: true, visibility: true },
  });

  if (!offer) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  if (offer.status !== "ACTIVE") {
    return NextResponse.json({ error: { code: "GONE" } }, { status: 410 });
  }

  const requestUrl = new URL(request.url);
  const advId = requestUrl.searchParams.get("adv_id")?.trim() || null;
  const pubId = requestUrl.searchParams.get("pub_id")?.trim() || null;
  const subIds = readSubIds(requestUrl.searchParams);
  const subColumns = {
    subId: subIds.sub1?.slice(0, 191) || null,
    subId2: subIds.sub2?.slice(0, 191) || null,
    subId3: subIds.sub3?.slice(0, 191) || null,
    subId4: subIds.sub4?.slice(0, 191) || null,
  };
  const src = requestUrl.searchParams.get("src")?.trim() || null;
  const leadIdParam = requestUrl.searchParams.get("lead_id")?.trim() || null;

  let clickId: string | null = null;
  let leadId: string | null = null;

  if (advId) {
    const advertiser = await prisma.user.findFirst({
      where: { id: advId, role: "ADVERTISER", status: "ACTIVE" },
      select: { id: true },
    });

    if (advertiser) {
      if (leadIdParam) {
        const lead = await prisma.lead.findFirst({
          where: {
            id: leadIdParam,
            campaign: { advertiserId: advertiser.id },
          },
          select: { id: true },
        });
        if (lead) leadId = lead.id;
      }

      const click = await prisma.cpaOfferClick.create({
        data: {
          offerId: offer.id,
          advertiserId: advertiser.id,
          leadId,
          ...subColumns,
          src: src?.slice(0, 191) || null,
          ip: clientIp(request)?.slice(0, 191) || null,
          userAgent: request.headers.get("user-agent")?.slice(0, 1000) || null,
        },
      });
      clickId = click.id;

      if (leadId) {
        await prisma.lead.updateMany({
          where: { id: leadId, ctaClicked: false },
          data: { ctaClicked: true },
        });
      }
    }
  } else if (pubId) {
    const publisher = await findActivePublisherByRef(pubId);

    if (publisher) {
      if (offer.visibility !== "PUBLIC") {
        const access = await prisma.publisherCpaOfferAccess.findUnique({
          where: {
            publisherId_offerId: { publisherId: publisher.id, offerId: offer.id },
          },
          select: { status: true },
        });
        if (access?.status !== "APPROVED") {
          return NextResponse.json(
            { error: { code: "FORBIDDEN", message: "Access not approved for this offer" } },
            { status: 403 },
          );
        }
      }

      const click = await prisma.cpaOfferClick.create({
        data: {
          offerId: offer.id,
          publisherId: publisher.id,
          ...subColumns,
          src: src?.slice(0, 191) || null,
          ip: clientIp(request)?.slice(0, 191) || null,
          userAgent: request.headers.get("user-agent")?.slice(0, 1000) || null,
        },
      });
      clickId = click.id;
    }
  }

  let destination = offer.trackingUrl;

  // Replace {click_id} macros before URL serialization encodes braces to %7B...%7D.
  if (clickId) {
    destination = injectClickIdIntoTrackingUrl(destination, clickId, requestUrl.origin);
  }

  try {
    const target = destination.startsWith("/")
      ? new URL(destination, requestUrl.origin)
      : new URL(destination);

    if (advId) target.searchParams.set("adv_id", advId);
    if (pubId) target.searchParams.set("pub_id", pubId);
    if (subIds.sub1) {
      target.searchParams.set("sub_id", subIds.sub1);
      target.searchParams.set("sub1", subIds.sub1);
    }
    if (subIds.sub2) target.searchParams.set("sub2", subIds.sub2);
    if (subIds.sub3) target.searchParams.set("sub3", subIds.sub3);
    if (subIds.sub4) target.searchParams.set("sub4", subIds.sub4);
    if (src) target.searchParams.set("src", src);

    destination = target.toString();
  } catch {
    // keep original destination
  }

  return NextResponse.redirect(destination, 302);
}
