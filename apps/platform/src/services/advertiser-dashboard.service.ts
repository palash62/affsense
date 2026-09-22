import { prisma } from "@cpl/database";
import { listPublishedAnnouncements } from "@/services/announcement.service";
import { ensureReferralCode } from "@/services/referral.service";
import { getWalletBalance } from "@/services/wallet.service";

export type AdvertiserDashboardPeriod = "7d" | "30d" | "month" | "year";

function periodStart(period: AdvertiserDashboardPeriod): Date {
  const now = new Date();
  const d = new Date(now);
  if (period === "7d") {
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "30d") {
    d.setDate(d.getDate() - 29);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "month") {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function previousPeriodBounds(period: AdvertiserDashboardPeriod): { from: Date; to: Date } {
  const to = periodStart(period);
  const from = new Date(to);
  const spanMs = Date.now() - to.getTime();
  from.setTime(from.getTime() - spanMs);
  return { from, to };
}

function calcTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function ownerOfferMetrics(ownerAdvertiserId: string, from: Date, to: Date) {
  const offerScope = { ownerAdvertiserId } as const;
  const clickWhere = {
    offer: offerScope,
    createdAt: { gte: from, lte: to },
  };
  const conversionWhere = {
    offer: offerScope,
    createdAt: { gte: from, lte: to },
  };

  const [clicks, conversions, conversionRows] = await Promise.all([
    prisma.cpaOfferClick.count({ where: clickWhere }),
    prisma.cpaOfferConversion.count({ where: conversionWhere }),
    prisma.cpaOfferConversion.findMany({
      where: conversionWhere,
      select: {
        payout: true,
        offer: { select: { payout: true, revenue: true } },
      },
    }),
  ]);

  let payoutSpend = 0;
  for (const row of conversionRows) {
    const payout =
      row.payout != null ? Number(row.payout) : Number(row.offer.payout ?? 0);
    payoutSpend += payout;
  }

  return { clicks, conversions, payoutSpend };
}

async function performanceSeries(ownerAdvertiserId: string, from: Date, to: Date) {
  const offerScope = { ownerAdvertiserId } as const;
  const [clickRows, conversionRows] = await Promise.all([
    prisma.cpaOfferClick.findMany({
      where: { offer: offerScope, createdAt: { gte: from, lte: to } },
      select: { createdAt: true },
    }),
    prisma.cpaOfferConversion.findMany({
      where: { offer: offerScope, createdAt: { gte: from, lte: to } },
      select: { createdAt: true },
    }),
  ]);

  const clicksByDay = new Map<string, number>();
  const conversionsByDay = new Map<string, number>();
  for (const row of clickRows) {
    const key = dayKey(row.createdAt);
    clicksByDay.set(key, (clicksByDay.get(key) ?? 0) + 1);
  }
  for (const row of conversionRows) {
    const key = dayKey(row.createdAt);
    conversionsByDay.set(key, (conversionsByDay.get(key) ?? 0) + 1);
  }

  const days: Array<{ date: string; label: string; clicks: number; conversions: number }> = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const key = dayKey(cursor);
    days.push({
      date: key,
      label: cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      clicks: clicksByDay.get(key) ?? 0,
      conversions: conversionsByDay.get(key) ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export async function getAffsenseAdvertiserDashboard(
  advertiserId: string,
  period: AdvertiserDashboardPeriod = "30d",
) {
  const from = periodStart(period);
  const to = new Date();
  const prev = previousPeriodBounds(period);

  const [
    wallet,
    activeOffers,
    totalOffers,
    current,
    previous,
    series,
    myOffers,
    announcements,
    referralCode,
  ] = await Promise.all([
    getWalletBalance(advertiserId),
    prisma.cpaOffer.count({
      where: { ownerAdvertiserId: advertiserId, status: "ACTIVE" },
    }),
    prisma.cpaOffer.count({
      where: { ownerAdvertiserId: advertiserId },
    }),
    ownerOfferMetrics(advertiserId, from, to),
    ownerOfferMetrics(advertiserId, prev.from, prev.to),
    performanceSeries(advertiserId, from, to),
    prisma.cpaOffer.findMany({
      where: { ownerAdvertiserId: advertiserId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        status: true,
        thumbnailUrl: true,
        category: true,
        payout: true,
        payoutModel: true,
      },
    }),
    listPublishedAnnouncements("ADVERTISER", 6),
    ensureReferralCode(advertiserId),
  ]);

  return {
    period,
    walletBalance: wallet?.availableBalance ?? 0,
    referralCode,
    kpis: {
      activeOffers,
      totalOffers,
      clicks: current.clicks,
      clicksTrend: calcTrend(current.clicks, previous.clicks),
      conversions: current.conversions,
      conversionsTrend: calcTrend(current.conversions, previous.conversions),
      payoutSpend: current.payoutSpend,
      payoutSpendTrend: calcTrend(current.payoutSpend, previous.payoutSpend),
    },
    series,
    myOffers: myOffers.map((o) => ({
      id: o.id,
      name: o.name,
      status: o.status,
      thumbnailUrl: o.thumbnailUrl,
      category: o.category,
      payout: Number(o.payout),
      payoutModel: o.payoutModel,
    })),
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      iconKey: a.iconKey,
      tone: a.tone,
      publishedAt: a.publishedAt ?? a.createdAt,
    })),
  };
}
