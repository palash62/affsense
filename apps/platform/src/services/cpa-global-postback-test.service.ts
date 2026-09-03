import { prisma } from "@/lib/prisma";
import { getTrackingUrl } from "@cpl/shared";
import { getCpaNetworkPostbackSettings } from "./cpa-network-postback.service";

export type CpaTestClickOption = {
  id: string;
  offerId: string;
  offerName: string;
  advertiserId: string | null;
  createdAt: string;
};

export async function listRecentCpaTestClicks(limit = 10): Promise<CpaTestClickOption[]> {
  const rows = await prisma.cpaOfferClick.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 50),
    select: {
      id: true,
      offerId: true,
      advertiserId: true,
      createdAt: true,
      offer: { select: { name: true, status: true } },
    },
  });

  return rows
    .filter((row) => row.offer.status !== "ARCHIVED")
    .map((row) => ({
      id: row.id,
      offerId: row.offerId,
      offerName: row.offer.name,
      advertiserId: row.advertiserId,
      createdAt: row.createdAt.toISOString(),
    }));
}

export function buildGlobalPostbackTestUrl(input: {
  clickId: string;
  payout?: string;
  useSecurityKey: boolean;
  securityKey: string;
}) {
  const trackingBase = getTrackingUrl();
  const url = new URL(`${trackingBase}/pbtr`);
  url.searchParams.set("click_id", input.clickId);
  if (input.payout != null && input.payout !== "") {
    url.searchParams.set("payout", input.payout);
  }
  if (input.useSecurityKey && input.securityKey) {
    url.searchParams.set("secure", input.securityKey);
  }
  return url.toString();
}

export async function fireGlobalPostbackTest(input: {
  clickId: string;
  payout?: string;
}) {
  const settings = await getCpaNetworkPostbackSettings();
  const testUrl = buildGlobalPostbackTestUrl({
    clickId: input.clickId.trim(),
    payout: input.payout?.trim() || "1",
    useSecurityKey: settings.useSecurityKey,
    securityKey: settings.securityKey,
  });

  const res = await fetch(testUrl, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    headers: { "User-Agent": "LeadVix-Admin-Postback-Test/1.0" },
  });

  const body = await res.json().catch(() => null);
  const conversionId =
    body && typeof body === "object" && typeof (body as { id?: string }).id === "string"
      ? (body as { id: string }).id
      : null;

  let deliveries: Array<{
    target: string;
    status: string;
    url: string;
    httpStatus: number | null;
    error: string | null;
  }> = [];

  if (conversionId) {
    const rows = await prisma.cpaPostbackDelivery.findMany({
      where: { conversionId },
      orderBy: { createdAt: "asc" },
    });
    deliveries = rows.map((row) => ({
      target: row.target,
      status: row.status,
      url: row.url,
      httpStatus: row.httpStatus,
      error: row.error,
    }));
  }

  return {
    testUrl,
    httpStatus: res.status,
    response: body,
    conversionId,
    deliveries,
  };
}
