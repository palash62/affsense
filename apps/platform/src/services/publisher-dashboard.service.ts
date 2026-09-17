import { prisma } from "@cpl/database";
import { listPublishedAnnouncements } from "@/services/announcement.service";
import { getPublisherEarningsForRange } from "@/lib/publisher-earnings";
import { formatPublisherLeadPayout } from "@/lib/publisher-leads";
import { getPlatformSettingsConfig } from "@/lib/platform-settings-server";
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

function previousPeriodBounds(period: PublisherDashboardPeriod): { from: Date; to: Date } {
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

async function publisherMetrics(publisherId: string, from: Date, to: Date) {
  const [clicks, totalLeads, approvedLeads, earnings] = await Promise.all([
    prisma.click.count({
      where: {
        trackingLink: { publisherId },
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.lead.count({
      where: { publisherId, createdAt: { gte: from, lte: to } },
    }),
    prisma.lead.count({
      where: {
        publisherId,
        status: { in: ["APPROVED", "PAID"] },
        createdAt: { gte: from, lte: to },
      },
    }),
    getPublisherEarningsForRange(publisherId, from, to),
  ]);

  const conversionRate = clicks > 0 ? (approvedLeads / clicks) * 100 : 0;
  return { clicks, totalLeads, approvedLeads, conversionRate, earnings };
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

export async function getAffsensePublisherDashboard(
  publisherId: string,
  period: PublisherDashboardPeriod = "30d",
) {
  await reconcilePublisherLeadCreditsForUser(publisherId);

  const from = periodStart(period);
  const to = new Date();
  const prev = previousPeriodBounds(period);

  const [wallet, current, previous, earningsChart, announcements, recentLeadsRaw, platformSettings] =
    await Promise.all([
      prisma.wallet.findUnique({ where: { userId: publisherId } }),
      publisherMetrics(publisherId, from, to),
      publisherMetrics(publisherId, prev.from, prev.to),
      earningsSeries(publisherId, period),
      listPublishedAnnouncements("PUBLISHER", 6),
      prisma.lead.findMany({
        where: { publisherId },
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          campaign: { select: { cpl: true } },
        },
      }),
      getPlatformSettingsConfig(),
    ]);

  const recentLeadIds = recentLeadsRaw.map((lead) => lead.id);
  const creditedEntries =
    recentLeadIds.length > 0
      ? await prisma.ledgerEntry.findMany({
          where: {
            type: "CREDIT",
            referenceType: "lead",
            referenceId: { in: recentLeadIds },
            wallet: { userId: publisherId },
          },
          select: { referenceId: true, amount: true },
        })
      : [];
  const creditedByLeadId = new Map(
    creditedEntries.map((entry) => [entry.referenceId, Number(entry.amount)]),
  );

  const availableBalance = wallet
    ? Number(wallet.balance) - Number(wallet.holdBalance)
    : 0;

  const recentLeads = recentLeadsRaw.map((lead) => {
    const creditedAmount = creditedByLeadId.get(lead.id);
    const payout = formatPublisherLeadPayout(lead, platformSettings, creditedAmount);
    return {
      id: lead.id,
      status: lead.status,
      createdAt: lead.createdAt.toISOString(),
      payoutLabel: payout.label,
      payoutClassName: payout.className,
    };
  });

  return {
    period,
    availableBalance,
    kpis: {
      clicks: current.clicks,
      clicksTrend: calcTrend(current.clicks, previous.clicks),
      totalLeads: current.totalLeads,
      leadsTrend: calcTrend(current.totalLeads, previous.totalLeads),
      conversionRate: current.conversionRate,
      conversionTrend: calcTrend(current.conversionRate, previous.conversionRate),
      earnings: current.earnings,
      earningsTrend: calcTrend(current.earnings, previous.earnings),
    },
    earningsChart,
    recentLeads,
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
