import { prisma } from "@cpl/database";
import { listPublishedAnnouncements } from "@/services/announcement.service";
import { listActiveCpaOffers } from "@/services/cpa-offer.service";
import { listDigitalProducts } from "@/services/digital-product.service";
import { listGetPaidTasks } from "@/services/get-paid-task.service";
import { reconcilePublisherLeadCreditsForUser } from "@/services/wallet.service";

export type PublisherDashboardPeriod = "7d" | "30d" | "month" | "year";

function periodStart(period: PublisherDashboardPeriod): Date {
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

function previousPeriodStart(period: PublisherDashboardPeriod): { from: Date; to: Date } {
  const to = periodStart(period);
  const from = new Date(to);
  const spanMs = Date.now() - to.getTime();
  from.setTime(from.getTime() - spanMs);
  return { from, to };
}

function calcTrend(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+100%" : "0%";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

async function sumLedgerCredits(publisherId: string, from?: Date, to?: Date) {
  const where: {
    type: "CREDIT";
    wallet: { userId: string };
    createdAt?: { gte?: Date; lte?: Date };
  } = {
    type: "CREDIT",
    wallet: { userId: publisherId },
  };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }
  const agg = await prisma.ledgerEntry.aggregate({
    where,
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}

async function pendingEarnings(publisherId: string) {
  const leads = await prisma.lead.findMany({
    where: {
      publisherId,
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: { id: true, status: true, campaign: { select: { cpl: true } } },
  });
  const credited = await prisma.ledgerEntry.findMany({
    where: {
      type: "CREDIT",
      referenceType: "lead",
      wallet: { userId: publisherId },
    },
    select: { referenceId: true },
  });
  const creditedIds = new Set(credited.map((e) => e.referenceId));
  return leads
    .filter((l) => !creditedIds.has(l.id))
    .reduce((sum, l) => sum + Number(l.campaign?.cpl ?? 0) * 0.7, 0);
}

async function earningsSeries(publisherId: string, period: PublisherDashboardPeriod) {
  const from = periodStart(period);
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      type: "CREDIT",
      wallet: { userId: publisherId },
      createdAt: { gte: from },
    },
    select: { amount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const byDay = new Map<string, number>();
  for (const e of entries) {
    const key = e.createdAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + Number(e.amount));
  }
  return Array.from(byDay.entries()).map(([date, amount]) => ({
    date,
    label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    amount,
  }));
}

export async function getAffsensePublisherDashboard(publisherId: string, period: PublisherDashboardPeriod = "30d") {
  await reconcilePublisherLeadCreditsForUser(publisherId);

  const from = periodStart(period);
  const prev = previousPeriodStart(period);

  const [
    wallet,
    totalEarnings,
    currentPeriodEarnings,
    previousPeriodEarnings,
    pending,
    tasksCompleted,
    totalReferrals,
    tasks,
    products,
    cpaOffers,
    announcements,
    recentPayouts,
    earningsChart,
  ] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: publisherId } }),
    sumLedgerCredits(publisherId),
    sumLedgerCredits(publisherId, from),
    sumLedgerCredits(publisherId, prev.from, prev.to),
    pendingEarnings(publisherId),
    prisma.publisherTaskSubmission.count({
      where: { publisherId, status: "APPROVED" },
    }),
    prisma.user.count({ where: { referredById: publisherId } }),
    listGetPaidTasks({ activeOnly: true, showOnDashboard: true, limit: 5 }),
    listDigitalProducts({ activeOnly: true, limit: 6 }),
    listActiveCpaOffers({ page: 1, limit: 6 }),
    listPublishedAnnouncements("PUBLISHER", 6),
    prisma.payout.findMany({
      where: { publisherId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, amount: true, status: true, createdAt: true, method: true },
    }),
    earningsSeries(publisherId, period),
  ]);

  const availableBalance = wallet
    ? Number(wallet.balance) - Number(wallet.holdBalance)
    : 0;

  const cpaRows = cpaOffers.items.map((o) => ({
    id: o.id,
    name: o.name,
    category: o.category ?? "CPA",
    commission: `${o.payout} ${o.payoutModel}`,
    earnings: 0,
    sales: 0,
    imageUrl: o.thumbnailUrl,
    type: "cpa" as const,
    hot: o.status === "ACTIVE",
  }));

  const productRows = products.items.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    commission: `${p.frontEndCommission}%`,
    earnings: 0,
    sales: 0,
    imageUrl: p.imageUrl,
    type: "product" as const,
    hot: p.featured,
  }));

  const topOffers = [...cpaRows, ...productRows]
    .sort((a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0))
    .slice(0, 5);

  return {
    period,
    kpis: {
      totalEarnings,
      totalEarningsTrend: calcTrend(currentPeriodEarnings, previousPeriodEarnings),
      pendingEarnings: pending,
      availableBalance,
      totalReferrals,
      referralsTrend: "+0",
      tasksCompleted,
      tasksToday: 0,
    },
    earningsChart,
    tasks: tasks.items.map((t) => ({
      id: t.id,
      title: t.title,
      platform: t.category,
      rewardAmount: t.rewardAmount,
      requiredAction: t.requiredAction,
    })),
    topOffers,
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      iconKey: a.iconKey,
      tone: a.tone,
      publishedAt: a.publishedAt ?? a.createdAt,
    })),
    recentReports: recentPayouts.map((p) => ({
      id: p.id,
      name: `Payout ${p.method}`,
      type: "Payout",
      dateRange: "—",
      generatedOn: p.createdAt.toISOString(),
      status: p.status,
    })),
  };
}
