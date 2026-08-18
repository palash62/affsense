import { prisma } from "@/lib/prisma";
import { PENDING_PAYOUT_STATUSES } from "@/lib/payout-status";
import { calculatePublisherPayout } from "@/lib/platform-settings";
import { getPlatformSettingsConfig } from "@/lib/platform-settings-server";
import { getLeadCpl } from "@/lib/lead-cpl";
import { loadCpaMetricsByCampaignIds, loadCpaMetricsByLeadIds } from "@/lib/cpa-lead-metrics";
import type { LeadStatus } from "@prisma/client";
import {
  getAdvertiserPeriodRange,
  type AdvertiserPeriod,
} from "@/lib/advertiser-periods";
import {
  calcTrend,
  getPublisherPeriodRange,
  type PublisherPeriod,
} from "@/lib/publisher-periods";
import { getPublisherEarningsForRange } from "@/lib/publisher-earnings";
import { formatPublisherLeadPayout } from "@/lib/publisher-leads";
import { reconcilePublisherLeadCreditsForUser } from "@/services/wallet.service";
import { getAdminProfitForRange } from "@/services/admin-profit.service";
import { ADVERTISER_EXCLUDED_LEAD_STATUSES } from "@/services/lead.service";
import { startOfDay, subDays, format, endOfMonth, startOfMonth, subMonths, endOfDay, differenceInCalendarDays } from "date-fns";

export async function getAdminDashboardStats() {
  const [
    totalAdvertisers,
    totalPublishers,
    totalCampaigns,
    totalLeads,
    approvedLeads,
    rejectedLeads,
    revenue,
    recentLeads,
    pendingPayouts,
    openTickets,
    leadsTrend,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "ADVERTISER", status: "ACTIVE" } }),
    prisma.user.count({ where: { role: "PUBLISHER", status: "ACTIVE" } }),
    prisma.campaign.count(),
    prisma.lead.count(),
    prisma.lead.count({ where: { status: { in: ["APPROVED", "PAID"] } } }),
    prisma.lead.count({ where: { status: "REJECTED" } }),
    prisma.platformFee.aggregate({ _sum: { feeAmount: true } }),
    prisma.lead.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        campaign: { select: { name: true } },
        publisher: { select: { name: true } },
      },
    }),
    prisma.payout.count({ where: { status: { in: [...PENDING_PAYOUT_STATUSES] } } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    getLeadsTrend(30),
  ]);

  return {
    totalAdvertisers,
    totalPublishers,
    totalCampaigns,
    totalLeads,
    approvedLeads,
    rejectedLeads,
    revenue: Number(revenue._sum.feeAmount ?? 0),
    recentLeads,
    pendingPayouts,
    openTickets,
    leadsTrend,
  };
}

export async function getAdvertiserDashboardStats(advertiserId: string) {
  const campaigns = await prisma.campaign.findMany({
    where: { advertiserId },
  });

  const campaignIds = campaigns.map((c) => c.id);
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;

  const [totalLeads, approvedLeads, rejectedLeads, pendingLeads] =
    await Promise.all([
      prisma.lead.count({ where: { campaignId: { in: campaignIds } } }),
      prisma.lead.count({
        where: { campaignId: { in: campaignIds }, status: { in: ["APPROVED", "PAID"] } },
      }),
      prisma.lead.count({
        where: { campaignId: { in: campaignIds }, status: "REJECTED" },
      }),
      prisma.lead.findMany({
        where: { campaignId: { in: campaignIds }, status: "PENDING" },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { campaign: { select: { name: true } } },
      }),
    ]);

  const totalSpend = campaigns.reduce((sum, c) => sum + Number(c.spent), 0);
  const avgCpl = approvedLeads > 0 ? totalSpend / approvedLeads : 0;

  return {
    activeCampaigns,
    totalLeads,
    approvedLeads,
    rejectedLeads,
    avgCpl,
    totalSpend,
    pendingLeads,
    leadsTrend: await getLeadsTrend(30, campaignIds),
  };
}

async function getAdvertiserCampaignIds(advertiserId: string) {
  const campaigns = await prisma.campaign.findMany({
    where: { advertiserId },
    select: { id: true },
  });
  return campaigns.map((c) => c.id);
}

export async function getAdvertiserMetricsForRange(
  advertiserId: string,
  from: Date,
  to: Date,
) {
  const campaignIds = await getAdvertiserCampaignIds(advertiserId);
  if (campaignIds.length === 0) {
    return { leads: 0, spent: 0, cpl: 0, clicks: 0 };
  }

  const [approvedLeads, clicks] = await Promise.all([
    prisma.lead.findMany({
      where: {
        campaignId: { in: campaignIds },
        status: { in: ["APPROVED", "PAID"] },
        isTest: false,
        createdAt: { gte: from, lte: to },
      },
      include: { campaign: { select: { cpl: true } } },
    }),
    prisma.click.count({
      where: {
        trackingLink: { campaignId: { in: campaignIds } },
        createdAt: { gte: from, lte: to },
      },
    }),
  ]);

  const spent = approvedLeads.reduce((sum, lead) => sum + getLeadCpl(lead), 0);
  const leads = approvedLeads.length;
  const cpl = leads > 0 ? spent / leads : 0;

  return {
    leads,
    spent,
    cpl,
    clicks,
  };
}

export async function getAdvertiserDashboardData(
  advertiserId: string,
  period: AdvertiserPeriod = "last30",
) {
  const { from, to, prevFrom, prevTo } = getAdvertiserPeriodRange(period);
  const campaignIds = await getAdvertiserCampaignIds(advertiserId);

  const [
    activeCampaigns,
    current,
    previous,
    pendingLeads,
    wallet,
    summaryRows,
  ] = await Promise.all([
    prisma.campaign.count({
      where: { advertiserId, status: "ACTIVE" },
    }),
    getAdvertiserMetricsForRange(advertiserId, from, to),
    getAdvertiserMetricsForRange(advertiserId, prevFrom, prevTo),
    prisma.lead.findMany({
      where: { campaign: { advertiserId }, status: "PENDING", isTest: false },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { campaign: { select: { name: true } } },
    }),
    prisma.wallet.findUnique({ where: { userId: advertiserId } }),
    getAdvertiserSummaryRows(advertiserId),
  ]);

  return {
    period,
    activeCampaigns,
    walletBalance: Number(wallet?.balance ?? 0),
    stats: {
      leads: current.leads,
      clicks: current.clicks,
      cpl: current.cpl,
      spent: current.spent,
      leadsTrend: calcTrend(current.leads, previous.leads),
      clicksTrend: calcTrend(current.clicks, previous.clicks),
      cplTrend: calcTrend(current.cpl, previous.cpl),
      spentTrend: calcTrend(current.spent, previous.spent),
    },
    pendingLeads,
    summaryRows,
    leadsTrend: campaignIds.length ? await getLeadsTrend(30, campaignIds) : [],
  };
}

async function getAdvertiserSummaryRows(advertiserId: string) {
  const now = new Date();
  const periods = [
    { label: "Today", from: startOfDay(now), to: endOfDay(now) },
    { label: "Yesterday", from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) },
    { label: "Last 7 Days", from: startOfDay(subDays(now, 6)), to: endOfDay(now) },
    { label: "Last 30 Days", from: startOfDay(subDays(now, 29)), to: endOfDay(now) },
    { label: "This Month", from: startOfMonth(now), to: endOfDay(now) },
    {
      label: "Last Month",
      from: startOfMonth(subMonths(now, 1)),
      to: endOfMonth(subMonths(now, 1)),
    },
  ];

  return Promise.all(
    periods.map(async (p) => {
      const metrics = await getAdvertiserMetricsForRange(advertiserId, p.from, p.to);
      return { label: p.label, ...metrics };
    }),
  );
}

async function getPublisherMetricsForRange(publisherId: string, from: Date, to: Date) {
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

export async function getPublisherDashboardData(
  publisherId: string,
  period: PublisherPeriod = "last30",
) {
  await reconcilePublisherLeadCreditsForUser(publisherId);

  const { from, to, prevFrom, prevTo } = getPublisherPeriodRange(period);
  const [current, previous, wallet, recentLeadsRaw, leadsTrend, platformSettings] =
    await Promise.all([
      getPublisherMetricsForRange(publisherId, from, to),
      getPublisherMetricsForRange(publisherId, prevFrom, prevTo),
      prisma.wallet.findUnique({ where: { userId: publisherId } }),
      prisma.lead.findMany({
        where: { publisherId },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          campaign: { select: { cpl: true } },
        },
      }),
      getPublisherLeadsTrend(30, publisherId),
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

  const recentLeads = recentLeadsRaw.map((lead) => {
    const creditedAmount = creditedByLeadId.get(lead.id);
    const payout = formatPublisherLeadPayout(lead, platformSettings, creditedAmount);
    return {
      id: lead.id,
      status: lead.status,
      createdAt: lead.createdAt,
      payoutLabel: payout.label,
      payoutClassName: payout.className,
    };
  });

  const availableBalance = wallet
    ? Number(wallet.balance) - Number(wallet.holdBalance)
    : 0;

  return {
    period,
    availableBalance,
    walletBalance: Number(wallet?.balance ?? 0),
    stats: {
      clicks: current.clicks,
      totalLeads: current.totalLeads,
      approvedLeads: current.approvedLeads,
      conversionRate: current.conversionRate,
      earnings: current.earnings,
      clicksTrend: calcTrend(current.clicks, previous.clicks),
      leadsTrend: calcTrend(current.totalLeads, previous.totalLeads),
      approvedTrend: calcTrend(current.approvedLeads, previous.approvedLeads),
      conversionTrend: calcTrend(current.conversionRate, previous.conversionRate),
      earningsTrend: calcTrend(current.earnings, previous.earnings),
    },
    recentLeads,
    leadsTrend,
  };
}

export async function getPublisherDashboardStats(publisherId: string) {
  const now = new Date();
  const from = startOfDay(now);
  const to = endOfDay(now);

  const [clicks, totalLeads, approvedLeads, earningsAgg] = await Promise.all([
    prisma.click.count({
      where: {
        trackingLink: { publisherId },
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.lead.count({ where: { publisherId } }),
    prisma.lead.count({
      where: { publisherId, status: { in: ["APPROVED", "PAID"] } },
    }),
    prisma.ledgerEntry.aggregate({
      where: {
        type: "CREDIT",
        referenceType: "lead",
        wallet: { userId: publisherId },
      },
      _sum: { amount: true },
    }),
  ]);

  const conversionRate = clicks > 0 ? (approvedLeads / clicks) * 100 : 0;
  const earnings = Number(earningsAgg._sum.amount ?? 0);

  const recentLeads = await prisma.lead.findMany({
    where: { publisherId },
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { campaign: { select: { name: true, cpl: true } } },
  });

  const topCampaigns = await prisma.lead.groupBy({
    by: ["campaignId"],
    where: { publisherId, status: { in: ["APPROVED", "PAID"] } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });

  return {
    clicks,
    totalLeads,
    approvedLeads,
    conversionRate,
    earnings,
    recentLeads,
    topCampaigns,
  };
}

async function getPublisherLeadsTrend(days: number, publisherId: string) {
  const since = startOfDay(subDays(new Date(), days));
  const leads = await prisma.lead.findMany({
    where: {
      publisherId,
      createdAt: { gte: since },
    },
    select: { createdAt: true },
  });

  const map = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    map.set(format(subDays(new Date(), days - 1 - i), "yyyy-MM-dd"), 0);
  }

  for (const lead of leads) {
    const key = format(lead.createdAt, "yyyy-MM-dd");
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
}

async function getLeadsTrend(days: number, campaignIds?: string[]) {
  const since = startOfDay(subDays(new Date(), days));
  const leads = await prisma.lead.findMany({
    where: {
      createdAt: { gte: since },
      isTest: false,
      ...(campaignIds && { campaignId: { in: campaignIds } }),
    },
    select: { createdAt: true },
  });

  const map = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    map.set(format(subDays(new Date(), days - 1 - i), "yyyy-MM-dd"), 0);
  }

  for (const lead of leads) {
    const key = format(lead.createdAt, "yyyy-MM-dd");
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
}

export type AdminEntityReportRow = {
  id: string;
  name: string;
  email: string;
  clicks: number;
  leads: number;
  approvedLeads: number;
  rejectedLeads: number;
  pendingLeads: number;
  conversionRate: number;
  approvalRate: number;
  salesCount: number;
  revenue: number;
  spend: number;
  earnings: number;
};

export type AdminReportsBreakdown = {
  totals: {
    clicks: number;
    leads: number;
    approvedLeads: number;
    rejectedLeads: number;
    pendingLeads: number;
    conversionRate: number;
    approvalRate: number;
    salesCount: number;
    revenue: number;
    spend: number;
    earnings: number;
  };
  publishers: AdminEntityReportRow[];
  advertisers: AdminEntityReportRow[];
};

function isApprovedLeadStatus(status: LeadStatus) {
  return status === "APPROVED" || status === "PAID";
}

function isRejectedLeadStatus(status: LeadStatus) {
  return status === "REJECTED";
}

function isPendingLeadStatus(status: LeadStatus) {
  return status === "PENDING" || status === "CAPTURED" || status === "VALIDATING";
}

function buildReportRow(
  user: { id: string; name: string; email: string },
  stats: {
    clicks: number;
    leads: number;
    approvedLeads: number;
    rejectedLeads: number;
    pendingLeads: number;
    salesCount: number;
    revenue: number;
    spend: number;
    earnings: number;
  },
): AdminEntityReportRow {
  const {
    clicks,
    leads,
    approvedLeads,
    rejectedLeads,
    pendingLeads,
    salesCount,
    revenue,
    spend,
    earnings,
  } = stats;
  const conversionRate = clicks > 0 ? Math.round((leads / clicks) * 10000) / 100 : 0;
  const approvalRate = leads > 0 ? Math.round((approvedLeads / leads) * 10000) / 100 : 0;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    clicks,
    leads,
    approvedLeads,
    rejectedLeads,
    pendingLeads,
    salesCount,
    revenue: Math.round(revenue * 100) / 100,
    spend: Math.round(spend * 100) / 100,
    earnings: Math.round(earnings * 100) / 100,
    conversionRate,
    approvalRate,
  };
}

type LeadBucket = {
  leads: number;
  approvedLeads: number;
  rejectedLeads: number;
  pendingLeads: number;
  salesCount: number;
  revenue: number;
  spend: number;
  earnings: number;
};

function emptyBucket(): LeadBucket {
  return {
    leads: 0,
    approvedLeads: 0,
    rejectedLeads: 0,
    pendingLeads: 0,
    salesCount: 0,
    revenue: 0,
    spend: 0,
    earnings: 0,
  };
}

function applyLeadToBucket(
  bucket: LeadBucket,
  status: LeadStatus,
  spendAmount: number,
  earningsAmount: number,
) {
  bucket.leads += 1;
  if (isRejectedLeadStatus(status)) {
    bucket.rejectedLeads += 1;
  } else if (isApprovedLeadStatus(status)) {
    bucket.approvedLeads += 1;
    if (status === "PAID") {
      bucket.spend += spendAmount;
      bucket.earnings += earningsAmount;
    }
  } else if (isPendingLeadStatus(status)) {
    bucket.pendingLeads += 1;
  }
}

export async function getAdminReportsBreakdown(filters?: {
  search?: string;
  from?: Date;
  to?: Date;
  sort?: "leads" | "clicks" | "conversion" | "spend";
}): Promise<AdminReportsBreakdown> {
  const search = filters?.search?.trim();
  const dateRange =
    filters?.from && filters?.to
      ? { createdAt: { gte: filters.from, lte: filters.to } }
      : undefined;

  const userSearch = search
    ? {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
        ],
      }
    : undefined;

  const [publishers, advertisers, platformSettings, leads, clicks] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PUBLISHER", ...userSearch },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "ADVERTISER", ...userSearch },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    getPlatformSettingsConfig(),
    prisma.lead.findMany({
      where: dateRange,
      select: {
        id: true,
        publisherId: true,
        status: true,
        country: true,
        cpl: true,
        campaign: { select: { advertiserId: true, cpl: true } },
      },
    }),
    prisma.click.findMany({
      where: dateRange,
      select: {
        trackingLink: {
          select: { publisherId: true, campaign: { select: { advertiserId: true } } },
        },
      },
    }),
  ]);

  const paidLeadIds = leads.filter((lead) => lead.status === "PAID").map((lead) => lead.id);
  const [publisherCredits, advertiserDebits, cpaMetricsByLeadId] = await Promise.all([
    paidLeadIds.length > 0
      ? prisma.ledgerEntry.findMany({
          where: { type: "CREDIT", referenceType: "lead", referenceId: { in: paidLeadIds } },
          select: {
            referenceId: true,
            amount: true,
            wallet: { select: { userId: true } },
          },
        })
      : Promise.resolve([]),
    paidLeadIds.length > 0
      ? prisma.ledgerEntry.findMany({
          where: { type: "DEBIT", referenceType: "lead", referenceId: { in: paidLeadIds } },
          select: {
            referenceId: true,
            amount: true,
            wallet: { select: { userId: true } },
          },
        })
      : Promise.resolve([]),
    loadCpaMetricsByLeadIds(leads.map((lead) => lead.id)),
  ]);

  const earningsByLeadId = new Map(
    publisherCredits.map((entry) => [entry.referenceId!, Number(entry.amount)]),
  );
  const earningsByPublisherId = new Map<string, number>();
  for (const entry of publisherCredits) {
    const userId = entry.wallet.userId;
    earningsByPublisherId.set(userId, (earningsByPublisherId.get(userId) ?? 0) + Number(entry.amount));
  }

  const spendByLeadId = new Map(
    advertiserDebits.map((entry) => [entry.referenceId!, Number(entry.amount)]),
  );
  const spendByAdvertiserId = new Map<string, number>();
  for (const entry of advertiserDebits) {
    const userId = entry.wallet.userId;
    spendByAdvertiserId.set(userId, (spendByAdvertiserId.get(userId) ?? 0) + Number(entry.amount));
  }

  function resolveLeadAmounts(lead: (typeof leads)[number]) {
    if (lead.status !== "PAID") {
      return { spend: 0, earnings: 0 };
    }

    const ledgerSpend = spendByLeadId.get(lead.id);
    const ledgerEarnings = earningsByLeadId.get(lead.id);
    if (ledgerSpend !== undefined && ledgerEarnings !== undefined) {
      return { spend: ledgerSpend, earnings: ledgerEarnings };
    }

    const cpl = getLeadCpl(lead);
    const { publisherAmount } = calculatePublisherPayout(cpl, lead.country, platformSettings);
    return { spend: cpl, earnings: publisherAmount };
  }

  const publisherClickMap = new Map<string, number>();
  const advertiserClickMap = new Map<string, number>();
  for (const click of clicks) {
    const { publisherId, campaign } = click.trackingLink;
    publisherClickMap.set(publisherId, (publisherClickMap.get(publisherId) ?? 0) + 1);
    advertiserClickMap.set(
      campaign.advertiserId,
      (advertiserClickMap.get(campaign.advertiserId) ?? 0) + 1,
    );
  }

  const publisherLeadMap = new Map<string, LeadBucket>();
  const advertiserLeadMap = new Map<string, LeadBucket>();

  for (const lead of leads) {
    const amounts = resolveLeadAmounts(lead);
    const cpaMetrics = cpaMetricsByLeadId.get(lead.id);

    const publisherBucket = publisherLeadMap.get(lead.publisherId) ?? emptyBucket();
    applyLeadToBucket(publisherBucket, lead.status, amounts.spend, amounts.earnings);
    if (cpaMetrics) {
      publisherBucket.salesCount += cpaMetrics.salesCount;
      publisherBucket.revenue += cpaMetrics.revenue;
    }
    publisherLeadMap.set(lead.publisherId, publisherBucket);

    const advertiserBucket = advertiserLeadMap.get(lead.campaign.advertiserId) ?? emptyBucket();
    applyLeadToBucket(advertiserBucket, lead.status, amounts.spend, amounts.earnings);
    if (cpaMetrics) {
      advertiserBucket.salesCount += cpaMetrics.salesCount;
      advertiserBucket.revenue += cpaMetrics.revenue;
    }
    advertiserLeadMap.set(lead.campaign.advertiserId, advertiserBucket);
  }

  for (const [publisherId, earnings] of earningsByPublisherId) {
    const bucket = publisherLeadMap.get(publisherId) ?? emptyBucket();
    bucket.earnings = earnings;
    publisherLeadMap.set(publisherId, bucket);
  }
  for (const [advertiserId, spend] of spendByAdvertiserId) {
    const bucket = advertiserLeadMap.get(advertiserId) ?? emptyBucket();
    bucket.spend = spend;
    advertiserLeadMap.set(advertiserId, bucket);
  }

  const sortKey = filters?.sort ?? "leads";
  const sortRows = (rows: AdminEntityReportRow[]) => {
    const sorted = [...rows];
    if (sortKey === "clicks") sorted.sort((a, b) => b.clicks - a.clicks || b.leads - a.leads);
    else if (sortKey === "conversion")
      sorted.sort((a, b) => b.conversionRate - a.conversionRate || b.leads - a.leads);
    else if (sortKey === "spend")
      sorted.sort((a, b) => b.spend - a.spend || b.leads - a.leads);
    else sorted.sort((a, b) => b.leads - a.leads || b.clicks - a.clicks);
    return sorted;
  };

  const publisherRows = sortRows(
    publishers.map((publisher) => {
      const bucket = publisherLeadMap.get(publisher.id) ?? emptyBucket();
      return buildReportRow(publisher, {
        clicks: publisherClickMap.get(publisher.id) ?? 0,
        leads: bucket.leads,
        approvedLeads: bucket.approvedLeads,
        rejectedLeads: bucket.rejectedLeads,
        pendingLeads: bucket.pendingLeads,
        salesCount: bucket.salesCount,
        revenue: bucket.revenue,
        spend: bucket.spend,
        earnings: bucket.earnings,
      });
    }),
  );

  const advertiserRows = sortRows(
    advertisers.map((advertiser) => {
      const bucket = advertiserLeadMap.get(advertiser.id) ?? emptyBucket();
      return buildReportRow(advertiser, {
        clicks: advertiserClickMap.get(advertiser.id) ?? 0,
        leads: bucket.leads,
        approvedLeads: bucket.approvedLeads,
        rejectedLeads: bucket.rejectedLeads,
        pendingLeads: bucket.pendingLeads,
        salesCount: bucket.salesCount,
        revenue: bucket.revenue,
        spend: bucket.spend,
        earnings: 0,
      });
    }),
  );

  const totalClicks = publisherRows.reduce((sum, row) => sum + row.clicks, 0);
  const totalLeads = publisherRows.reduce((sum, row) => sum + row.leads, 0);
  const totalApproved = publisherRows.reduce((sum, row) => sum + row.approvedLeads, 0);

  const totalSalesCount = publisherRows.reduce((sum, row) => sum + row.salesCount, 0);
  const totalRevenue = publisherRows.reduce((sum, row) => sum + row.revenue, 0);

  return {
    totals: {
      clicks: totalClicks,
      leads: totalLeads,
      approvedLeads: totalApproved,
      rejectedLeads: publisherRows.reduce((sum, row) => sum + row.rejectedLeads, 0),
      pendingLeads: publisherRows.reduce((sum, row) => sum + row.pendingLeads, 0),
      salesCount: totalSalesCount,
      revenue: Math.round(totalRevenue * 100) / 100,
      spend: advertiserRows.reduce((sum, row) => sum + row.spend, 0),
      earnings: publisherRows.reduce((sum, row) => sum + row.earnings, 0),
      conversionRate: totalClicks > 0 ? Math.round((totalLeads / totalClicks) * 10000) / 100 : 0,
      approvalRate: totalLeads > 0 ? Math.round((totalApproved / totalLeads) * 10000) / 100 : 0,
    },
    publishers: publisherRows,
    advertisers: advertiserRows,
  };
}

export type LeadsStatusMixItem = { name: string; value: number };

export type CampaignPerformanceRow = {
  campaignId: string;
  campaignName: string;
  status: string;
  clicks: number;
  leads: number;
  approvedLeads: number;
  rejectedLeads: number;
  pendingLeads: number;
  salesCount: number;
  revenue: number;
  spend: number;
  cpl: number;
  conversionRate: number;
  approvalRate: number;
};

export type GeoBreakdownRow = {
  country: string;
  leads: number;
  approvedLeads: number;
  spend: number;
};

export type AdvertiserReportsMetrics = {
  activeCampaigns: number;
  clicks: number;
  leads: number;
  approvedLeads: number;
  rejectedLeads: number;
  pendingLeads: number;
  spend: number;
  cpl: number;
  conversionRate: number;
  approvalRate: number;
};

export type AdminReportsOverview = {
  clicks: number;
  leads: number;
  approvedLeads: number;
  rejectedLeads: number;
  pendingLeads: number;
  conversionRate: number;
  approvalRate: number;
  spend: number;
  earnings: number;
  platformFees: number;
  profit: number;
  pendingPayoutCount: number;
  pendingPayoutAmount: number;
  avgRiskScore: number;
  highRiskLeads: number;
  leadsTrend: Array<{ date: string; count: number }>;
};

export type FraudReportSnapshot = {
  avgRiskScore: number;
  highRiskLeads: number;
  rejectedLeads: number;
  duplicateFlags: number;
  disposableEmails: number;
};

function statusLabel(status: LeadStatus): string {
  if (isApprovedLeadStatus(status)) return "Approved";
  if (isRejectedLeadStatus(status)) return "Rejected";
  if (isPendingLeadStatus(status)) return "Pending";
  return status;
}

export async function getAdvertiserLeadsTrendInRange(
  advertiserId: string,
  from: Date,
  to: Date,
): Promise<Array<{ date: string; count: number }>> {
  const campaignIds = await getAdvertiserCampaignIds(advertiserId);
  if (campaignIds.length === 0) return [];
  return getLeadsTrendInRange(from, to, campaignIds);
}

export type ActivityTrendPoint = {
  date: string;
  clicks: number;
  leads: number;
  approved: number;
};

export async function getActivityTrendInRange(filters: {
  advertiserId?: string;
  from: Date;
  to: Date;
}): Promise<ActivityTrendPoint[]> {
  const campaignIds = filters.advertiserId
    ? await getAdvertiserCampaignIds(filters.advertiserId)
    : undefined;

  if (filters.advertiserId && (!campaignIds || campaignIds.length === 0)) {
    return [];
  }

  const start = startOfDay(filters.from);
  const end = endOfDay(filters.to);
  const days = Math.max(1, differenceInCalendarDays(end, start) + 1);

  const [leads, clicks] = await Promise.all([
    prisma.lead.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(campaignIds && campaignIds.length > 0 && { campaignId: { in: campaignIds } }),
        ...(filters.advertiserId && {
          status: { notIn: [...ADVERTISER_EXCLUDED_LEAD_STATUSES] },
        }),
      },
      select: { createdAt: true, status: true },
    }),
    prisma.click.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(campaignIds && campaignIds.length > 0 && {
          trackingLink: { campaignId: { in: campaignIds } },
        }),
      },
      select: { createdAt: true },
    }),
  ]);

  const map = new Map<string, ActivityTrendPoint>();
  for (let i = 0; i < days; i++) {
    const date = format(subDays(end, days - 1 - i), "yyyy-MM-dd");
    map.set(date, { date, clicks: 0, leads: 0, approved: 0 });
  }

  for (const click of clicks) {
    const key = format(click.createdAt, "yyyy-MM-dd");
    const row = map.get(key);
    if (row) row.clicks += 1;
  }

  for (const lead of leads) {
    const key = format(lead.createdAt, "yyyy-MM-dd");
    const row = map.get(key);
    if (!row) continue;
    row.leads += 1;
    if (isApprovedLeadStatus(lead.status)) row.approved += 1;
  }

  return Array.from(map.values());
}

export async function getLeadsTrendInRange(
  from: Date,
  to: Date,
  campaignIds?: string[],
): Promise<Array<{ date: string; count: number }>> {
  const start = startOfDay(from);
  const end = endOfDay(to);
  const days = Math.max(1, differenceInCalendarDays(end, start) + 1);

  const leads = await prisma.lead.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      isTest: false,
      ...(campaignIds && campaignIds.length > 0 && { campaignId: { in: campaignIds } }),
    },
    select: { createdAt: true },
  });

  const map = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    map.set(format(subDays(end, days - 1 - i), "yyyy-MM-dd"), 0);
  }

  for (const lead of leads) {
    const key = format(lead.createdAt, "yyyy-MM-dd");
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
}

export async function getLeadsStatusMix(filters: {
  advertiserId?: string;
  from: Date;
  to: Date;
}): Promise<LeadsStatusMixItem[]> {
  const campaignIds = filters.advertiserId
    ? await getAdvertiserCampaignIds(filters.advertiserId)
    : undefined;

  const leads = await prisma.lead.findMany({
    where: {
      createdAt: { gte: filters.from, lte: filters.to },
      isTest: false,
      ...(campaignIds && campaignIds.length > 0 && { campaignId: { in: campaignIds } }),
      ...(filters.advertiserId && {
        status: { notIn: [...ADVERTISER_EXCLUDED_LEAD_STATUSES] },
      }),
    },
    select: { status: true },
  });

  const buckets = new Map<string, number>();
  for (const lead of leads) {
    const label = statusLabel(lead.status);
    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }

  return Array.from(buckets.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export async function getAdvertiserReportsMetrics(
  advertiserId: string,
  from: Date,
  to: Date,
): Promise<AdvertiserReportsMetrics> {
  const campaignIds = await getAdvertiserCampaignIds(advertiserId);
  if (campaignIds.length === 0) {
    return {
      activeCampaigns: 0,
      clicks: 0,
      leads: 0,
      approvedLeads: 0,
      rejectedLeads: 0,
      pendingLeads: 0,
      spend: 0,
      cpl: 0,
      conversionRate: 0,
      approvalRate: 0,
    };
  }

  const dateRange = { createdAt: { gte: from, lte: to } };
  const [activeCampaigns, leads, clicks] = await Promise.all([
    prisma.campaign.count({ where: { advertiserId, status: "ACTIVE" } }),
    prisma.lead.findMany({
      where: {
        campaignId: { in: campaignIds },
        isTest: false,
        status: { notIn: [...ADVERTISER_EXCLUDED_LEAD_STATUSES] },
        ...dateRange,
      },
      select: { status: true, cpl: true, campaign: { select: { cpl: true } } },
    }),
    prisma.click.count({
      where: {
        trackingLink: { campaignId: { in: campaignIds } },
        createdAt: { gte: from, lte: to },
      },
    }),
  ]);

  let approvedLeads = 0;
  let rejectedLeads = 0;
  let pendingLeads = 0;
  let spend = 0;

  for (const lead of leads) {
    if (isRejectedLeadStatus(lead.status)) {
      rejectedLeads += 1;
    } else if (isApprovedLeadStatus(lead.status)) {
      approvedLeads += 1;
      if (lead.status === "PAID") {
        spend += getLeadCpl(lead);
      }
    } else if (isPendingLeadStatus(lead.status)) {
      pendingLeads += 1;
    }
  }

  const totalLeads = leads.length;
  const cpl = approvedLeads > 0 ? spend / approvedLeads : 0;

  return {
    activeCampaigns,
    clicks,
    leads: totalLeads,
    approvedLeads,
    rejectedLeads,
    pendingLeads,
    spend: Math.round(spend * 100) / 100,
    cpl: Math.round(cpl * 100) / 100,
    conversionRate: clicks > 0 ? Math.round((totalLeads / clicks) * 10000) / 100 : 0,
    approvalRate: totalLeads > 0 ? Math.round((approvedLeads / totalLeads) * 10000) / 100 : 0,
  };
}

export async function getCampaignPerformanceReport(filters: {
  advertiserId?: string;
  from: Date;
  to: Date;
}): Promise<CampaignPerformanceRow[]> {
  const campaignWhere = filters.advertiserId ? { advertiserId: filters.advertiserId } : {};
  const campaigns = await prisma.campaign.findMany({
    where: campaignWhere,
    select: { id: true, name: true, status: true, cpl: true },
    orderBy: { name: "asc" },
  });

  if (campaigns.length === 0) return [];

  const campaignIds = campaigns.map((c) => c.id);
  const dateRange = { createdAt: { gte: filters.from, lte: filters.to } };

  const [leads, clicks, cpaMetricsByCampaign] = await Promise.all([
    prisma.lead.findMany({
      where: {
        campaignId: { in: campaignIds },
        isTest: false,
        ...dateRange,
        ...(filters.advertiserId && {
          status: { notIn: [...ADVERTISER_EXCLUDED_LEAD_STATUSES] },
        }),
      },
      select: { campaignId: true, status: true, cpl: true, campaign: { select: { cpl: true } } },
    }),
    prisma.click.findMany({
      where: {
        trackingLink: { campaignId: { in: campaignIds } },
        createdAt: { gte: filters.from, lte: filters.to },
      },
      select: { trackingLink: { select: { campaignId: true } } },
    }),
    loadCpaMetricsByCampaignIds(campaignIds, filters.from, filters.to),
  ]);

  const clickMap = new Map<string, number>();
  for (const click of clicks) {
    const id = click.trackingLink.campaignId;
    clickMap.set(id, (clickMap.get(id) ?? 0) + 1);
  }

  const leadMap = new Map<string, LeadBucket>();
  for (const lead of leads) {
    const bucket = leadMap.get(lead.campaignId) ?? emptyBucket();
    const spendAmount = lead.status === "PAID" ? getLeadCpl(lead) : 0;
    applyLeadToBucket(bucket, lead.status, spendAmount, 0);
    leadMap.set(lead.campaignId, bucket);
  }

  return campaigns
    .map((campaign) => {
      const bucket = leadMap.get(campaign.id) ?? emptyBucket();
      const clicksCount = clickMap.get(campaign.id) ?? 0;
      const conversionRate =
        clicksCount > 0 ? Math.round((bucket.leads / clicksCount) * 10000) / 100 : 0;
      const approvalRate =
        bucket.leads > 0 ? Math.round((bucket.approvedLeads / bucket.leads) * 10000) / 100 : 0;
      const cpl = bucket.approvedLeads > 0 ? bucket.spend / bucket.approvedLeads : Number(campaign.cpl);
      const cpaMetrics = cpaMetricsByCampaign.get(campaign.id);

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        status: campaign.status,
        clicks: clicksCount,
        leads: bucket.leads,
        approvedLeads: bucket.approvedLeads,
        rejectedLeads: bucket.rejectedLeads,
        pendingLeads: bucket.pendingLeads,
        salesCount: cpaMetrics?.salesCount ?? 0,
        revenue: Math.round((cpaMetrics?.revenue ?? 0) * 100) / 100,
        spend: Math.round(bucket.spend * 100) / 100,
        cpl: Math.round(cpl * 100) / 100,
        conversionRate,
        approvalRate,
      };
    })
    .filter((row) => row.leads > 0 || row.clicks > 0)
    .sort((a, b) => b.leads - a.leads || b.spend - a.spend);
}

export async function getGeoLeadBreakdown(filters: {
  advertiserId?: string;
  from: Date;
  to: Date;
  limit?: number;
}): Promise<GeoBreakdownRow[]> {
  const campaignIds = filters.advertiserId
    ? await getAdvertiserCampaignIds(filters.advertiserId)
    : undefined;

  const leads = await prisma.lead.findMany({
    where: {
      createdAt: { gte: filters.from, lte: filters.to },
      isTest: false,
      ...(campaignIds && campaignIds.length > 0 && { campaignId: { in: campaignIds } }),
      ...(filters.advertiserId && {
        status: { notIn: [...ADVERTISER_EXCLUDED_LEAD_STATUSES] },
      }),
    },
    select: { country: true, status: true, cpl: true, campaign: { select: { cpl: true } } },
  });

  const map = new Map<string, { leads: number; approvedLeads: number; spend: number }>();
  for (const lead of leads) {
    const country = lead.country?.trim() || "Unknown";
    const bucket = map.get(country) ?? { leads: 0, approvedLeads: 0, spend: 0 };
    bucket.leads += 1;
    if (isApprovedLeadStatus(lead.status)) {
      bucket.approvedLeads += 1;
      if (lead.status === "PAID") {
        bucket.spend += getLeadCpl(lead);
      }
    }
    map.set(country, bucket);
  }

  return Array.from(map.entries())
    .map(([country, stats]) => ({
      country,
      leads: stats.leads,
      approvedLeads: stats.approvedLeads,
      spend: Math.round(stats.spend * 100) / 100,
    }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, filters.limit ?? 15);
}

export async function getFraudReportSnapshot(filters: {
  from: Date;
  to: Date;
}): Promise<FraudReportSnapshot> {
  const dateRange = { createdAt: { gte: filters.from, lte: filters.to } };
  const leadIdsInRange = await prisma.lead.findMany({
    where: dateRange,
    select: { id: true },
  });
  const ids = leadIdsInRange.map((l) => l.id);

  const [riskAgg, highRiskLeads, rejectedLeads, duplicateFlags, disposableEmails] =
    await Promise.all([
      prisma.lead.aggregate({
        _avg: { riskScore: true },
        where: { ...dateRange, riskScore: { not: null } },
      }),
      prisma.lead.count({
        where: { ...dateRange, riskScore: { gte: 51 } },
      }),
      prisma.lead.count({
        where: { ...dateRange, status: "REJECTED" },
      }),
      ids.length > 0
        ? prisma.leadValidationResult.count({
            where: {
              leadId: { in: ids },
              rule: { in: ["duplicate_email", "duplicate_phone", "duplicate_ip", "duplicate_device"] },
              passed: false,
            },
          })
        : Promise.resolve(0),
      ids.length > 0
        ? prisma.leadValidationResult.count({
            where: {
              leadId: { in: ids },
              rule: "disposable_email",
              passed: false,
            },
          })
        : Promise.resolve(0),
    ]);

  return {
    avgRiskScore: Math.round(riskAgg._avg.riskScore ?? 0),
    highRiskLeads,
    rejectedLeads,
    duplicateFlags,
    disposableEmails,
  };
}

export async function getAdminReportsOverview(filters: {
  from: Date;
  to: Date;
}): Promise<AdminReportsOverview> {
  const breakdown = await getAdminReportsBreakdown({ from: filters.from, to: filters.to });
  const [platformFees, profit, pendingPayouts, leadsTrend, fraud] = await Promise.all([
    prisma.platformFee.aggregate({
      where: {
        lead: { createdAt: { gte: filters.from, lte: filters.to } },
      },
      _sum: { feeAmount: true },
    }),
    getAdminProfitForRange(filters.from, filters.to),
    prisma.payout.findMany({
      where: { status: { in: [...PENDING_PAYOUT_STATUSES] } },
      select: { amount: true },
    }),
    getLeadsTrendInRange(filters.from, filters.to),
    getFraudReportSnapshot(filters),
  ]);

  const pendingPayoutAmount = pendingPayouts.reduce((sum, row) => sum + Number(row.amount), 0);

  return {
    ...breakdown.totals,
    platformFees: Math.round(Number(platformFees._sum.feeAmount ?? 0) * 100) / 100,
    profit: Math.round(profit.adminProfit * 100) / 100,
    pendingPayoutCount: pendingPayouts.length,
    pendingPayoutAmount: Math.round(pendingPayoutAmount * 100) / 100,
    avgRiskScore: fraud.avgRiskScore,
    highRiskLeads: fraud.highRiskLeads,
    leadsTrend,
  };
}
