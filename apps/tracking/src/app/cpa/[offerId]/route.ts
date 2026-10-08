import { prisma } from "@cpl/database";
import { readSubIds } from "@cpl/shared";
import { NextResponse } from "next/server";
import { findActivePublisherByRef } from "@/lib/member-ref";
import { buildCpaOfferDestination, clientIp, createCpaPublisherClick } from "@/lib/offer-clicks";
import { SOLO_CLICK_PARAM, findLinkedCpaClick, resolveSoloClickLink } from "@/lib/solo-link";

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
  const src = requestUrl.searchParams.get("src")?.trim() || null;
  const leadIdParam = requestUrl.searchParams.get("lead_id")?.trim() || null;
  const visitor = { ip: clientIp(request), userAgent: request.headers.get("user-agent") };

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
          subId: subIds.sub1?.slice(0, 191) || null,
          subId2: subIds.sub2?.slice(0, 191) || null,
          subId3: subIds.sub3?.slice(0, 191) || null,
          subId4: subIds.sub4?.slice(0, 191) || null,
          src: src?.slice(0, 191) || null,
          ip: visitor.ip?.slice(0, 191) || null,
          userAgent: visitor.userAgent?.slice(0, 1000) || null,
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

      const soloClickId = await resolveSoloClickLink({
        rawId: requestUrl.searchParams.get(SOLO_CLICK_PARAM),
        publisherId: publisher.id,
        offerType: "CPA",
        offerId: offer.id,
      });
      const existing = soloClickId ? await findLinkedCpaClick(soloClickId) : null;
      if (existing) {
        clickId = existing.id;
      } else {
        try {
          const click = await createCpaPublisherClick(prisma, {
            offerId: offer.id,
            publisherId: publisher.id,
            subIds,
            src,
            visitor,
            soloClickId,
          });
          clickId = click.id;
        } catch (error) {
          if (!soloClickId) throw error;
          clickId = (await findLinkedCpaClick(soloClickId))?.id ?? null;
        }
      }
    }
  }

  const destination = buildCpaOfferDestination({
    trackingUrl: offer.trackingUrl,
    clickId,
    origin: requestUrl.origin,
    advId,
    pubId,
    subIds,
    src,
  });

  return NextResponse.redirect(destination, 302);
}
