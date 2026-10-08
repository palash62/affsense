import { prisma } from "@cpl/database";
import { listPublishedAnnouncements } from "@/services/announcement.service";
import { reconcilePublisherLeadCreditsForUser } from "@/services/wallet.service";
import {
  getPublisherCommissionReport,
  REFUNDED_WEBHOOK_STATUS,
} from "@/services/digital-product.service";
import { getUninvoicedTotalForPublisher } from "@/services/affiliate-invoice.service";
import {
  ensureReferralCode,
  getPublisherReferralEarnings,
  reconcilePublisherReferralCommissions,
} from "@/services/referral.service";
import {
  withPerformanceRatios,
  type PerformanceRow,
  type PerformanceSource,
} from "@/lib/publisher-performance";

export type PublisherDashboardPeriod = "7d" | "30d" | "month" | "year";

export const PUBLISHER_DASHBOARD_SOURCES = ["all", "digital", "cpa", "offerwall", "tasks"] as const;
export type PublisherDashboardSource = (typeof PUBLISHER_DASHBOARD_SOURCES)[number];

export function parsePublisherDashboardSource(
  value: string | null | undefined,
): PublisherDashboardSource {
  return PUBLISHER_DASHBOARD_SOURCES.includes(value as PublisherDashboardSource)
    ? (value as PublisherDashboardSource)
    : "all";
}

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

type DayBucket = { clicks: number; conversions: number; earnings: number };
type SourceMetrics = {
  clicks: number;
  conversions: number;
  earnings: number;
  byDay: Map<string, DayBucket>;
};

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyMetrics(): SourceMetrics {
  return { clicks: 0, conversions: 0, earnings: 0, byDay: new Map() };
}

function addToDay(
  metrics: SourceMetrics,
  key: string,
  delta: Partial<DayBucket>,
) {
  const bucket = metrics.byDay.get(key) ?? { clicks: 0, conversions: 0, earnings: 0 };
  bucket.clicks += delta.clicks ?? 0;
  bucket.conversions += delta.conversions ?? 0;
  bucket.earnings += delta.earnings ?? 0;
  metrics.byDay.set(key, bucket);
  metrics.clicks += delta.clicks ?? 0;
  metrics.conversions += delta.conversions ?? 0;
  metrics.earnings += delta.earnings ?? 0;
}

function collectRows(
  metrics: SourceMetrics,
  clicks: { createdAt: Date }[],
  conversions: { createdAt: Date; amount: number }[],
) {
  for (const row of clicks) addToDay(metrics, dayKey(row.createdAt), { clicks: 1 });
  for (const row of conversions) {
    addToDay(metrics, dayKey(row.createdAt), { conversions: 1, earnings: row.amount });
  }
  return metrics;
}

async function digitalMetrics(publisherId: string, from: Date, to: Date) {
  const [clicks, report] = await Promise.all([
    prisma.digitalProductClick.findMany({
      where: { publisherId, createdAt: { gte: from, lte: to } },
      select: { createdAt: true },
    }),
    getPublisherCommissionReport({ publisherId, from, to, status: "approved", limit: 1 }),
  ]);
  const metrics = collectRows(emptyMetrics(), clicks, []);
  for (const point of report.series) {
    if (point.orders === 0 && point.commission === 0) continue;
    addToDay(metrics, point.date, { conversions: point.orders, earnings: point.commission });
  }
  return metrics;
}

async function cpaMetrics(publisherId: string, from: Date, to: Date) {
  const range = { gte: from, lte: to };
  const [clicks, conversions] = await Promise.all([
    prisma.cpaOfferClick.findMany({
      where: { publisherId, createdAt: range },
      select: { createdAt: true },
    }),
    prisma.cpaOfferConversion.findMany({
      where: { clickRecord: { publisherId }, createdAt: range },
      select: { createdAt: true, payout: true },
    }),
  ]);
  return collectRows(
    emptyMetrics(),
    clicks,
    conversions.map((c) => ({ createdAt: c.createdAt, amount: Number(c.payout ?? 0) })),
  );
}

async function offerwallMetrics(publisherId: string, from: Date, to: Date) {
  const range = { gte: from, lte: to };
  const [clicks, conversions] = await Promise.all([
    prisma.offerwallClick.findMany({
      where: { publisherId, createdAt: range },
      select: { createdAt: true },
    }),
    prisma.offerwallConversion.findMany({
      where: { publisherId, createdAt: range },
      select: { createdAt: true, payout: true },
    }),
  ]);
  return collectRows(
    emptyMetrics(),
    clicks,
    conversions.map((c) => ({ createdAt: c.createdAt, amount: Number(c.payout) })),
  );
}

async function taskMetrics(publisherId: string, from: Date, to: Date) {
  const submissions = await prisma.publisherTaskSubmission.findMany({
    where: { publisherId, createdAt: { gte: from, lte: to } },
    select: { createdAt: true, status: true, rewardAmount: true },
  });
  return collectRows(
    emptyMetrics(),
    submissions,
    submissions
      .filter((s) => s.status === "APPROVED")
      .map((s) => ({ createdAt: s.createdAt, amount: Number(s.rewardAmount) })),
  );
}

const SOURCE_LOADERS: Record<
  Exclude<PublisherDashboardSource, "all">,
  (publisherId: string, from: Date, to: Date) => Promise<SourceMetrics>
> = {
  digital: digitalMetrics,
  cpa: cpaMetrics,
  offerwall: offerwallMetrics,
  tasks: taskMetrics,
};

async function sourceMetrics(
  publisherId: string,
  source: PublisherDashboardSource,
  from: Date,
  to: Date,
): Promise<SourceMetrics> {
  if (source !== "all") return SOURCE_LOADERS[source](publisherId, from, to);

  const parts = await Promise.all(
    Object.values(SOURCE_LOADERS).map((load) => load(publisherId, from, to)),
  );
  const merged = emptyMetrics();
  for (const part of parts) {
    for (const [key, bucket] of part.byDay) addToDay(merged, key, bucket);
  }
  return merged;
}

function dailySeries(metrics: SourceMetrics, from: Date, to: Date) {
  const series: Array<{ date: string } & DayBucket> = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cursor <= last) {
    const key = dayKey(cursor);
    const bucket = metrics.byDay.get(key) ?? { clicks: 0, conversions: 0, earnings: 0 };
    series.push({ date: key, ...bucket });
    cursor.setDate(cursor.getDate() + 1);
  }
  return series;
}

type OfferSource = Exclude<PublisherDashboardSource, "all">;

export type DashboardTopOffer = {
  source: OfferSource;
  name: string;
  clicks: number;
  conversions: number;
  earnings: number;
  cr: number;
};

type OfferTotals = Omit<DashboardTopOffer, "cr">;

function offerAccumulator(source: OfferSource) {
  const map = new Map<string, OfferTotals>();
  return {
    add(key: string, name: string, delta: { clicks?: number; conversions?: number; earnings?: number }) {
      const row = map.get(key) ?? { source, name, clicks: 0, conversions: 0, earnings: 0 };
      row.clicks += delta.clicks ?? 0;
      row.conversions += delta.conversions ?? 0;
      row.earnings += delta.earnings ?? 0;
      map.set(key, row);
    },
    rows: () => [...map.values()],
  };
}

async function digitalTopOffers(publisherId: string, from: Date, to: Date) {
  const [clicks, report] = await Promise.all([
    prisma.digitalProductClick.groupBy({
      by: ["productId"],
      where: { publisherId, createdAt: { gte: from, lte: to } },
      _count: { _all: true },
    }),
    getPublisherCommissionReport({ publisherId, from, to, status: "approved", limit: 1 }),
  ]);
  const products = await prisma.digitalProduct.findMany({
    where: { id: { in: clicks.map((c) => c.productId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(products.map((p) => [p.id, p.name]));
  const acc = offerAccumulator("digital");
  for (const c of clicks) {
    const name = nameById.get(c.productId) ?? "Digital product";
    acc.add(name, name, { clicks: c._count._all });
  }
  for (const stat of report.productStats) {
    acc.add(stat.name, stat.name, { conversions: stat.orders, earnings: stat.commission });
  }
  return acc.rows();
}

async function cpaTopOffers(publisherId: string, from: Date, to: Date) {
  const range = { gte: from, lte: to };
  const [clicks, conversions] = await Promise.all([
    prisma.cpaOfferClick.groupBy({
      by: ["offerId"],
      where: { publisherId, createdAt: range },
      _count: { _all: true },
    }),
    prisma.cpaOfferConversion.findMany({
      where: { clickRecord: { publisherId }, createdAt: range },
      select: { offerId: true, payout: true },
    }),
  ]);
  const offerIds = [...new Set([...clicks.map((c) => c.offerId), ...conversions.map((c) => c.offerId)])];
  const offers = await prisma.cpaOffer.findMany({
    where: { id: { in: offerIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(offers.map((o) => [o.id, o.name]));
  const acc = offerAccumulator("cpa");
  for (const c of clicks) {
    acc.add(c.offerId, nameById.get(c.offerId) ?? "CPA offer", { clicks: c._count._all });
  }
  for (const c of conversions) {
    acc.add(c.offerId, nameById.get(c.offerId) ?? "CPA offer", {
      conversions: 1,
      earnings: Number(c.payout ?? 0),
    });
  }
  return acc.rows();
}

async function offerwallNames(publisherId: string, offerIds: string[]) {
  if (offerIds.length === 0) return new Map<string, string>();
  const named = await prisma.offerwallClick.groupBy({
    by: ["offerId", "offerName"],
    where: { publisherId, offerId: { in: offerIds }, offerName: { not: null } },
  });
  return new Map(named.map((n) => [n.offerId, n.offerName ?? n.offerId]));
}

async function offerwallTopOffers(publisherId: string, from: Date, to: Date) {
  const range = { gte: from, lte: to };
  const [clicks, conversions] = await Promise.all([
    prisma.offerwallClick.groupBy({
      by: ["offerId"],
      where: { publisherId, createdAt: range },
      _count: { _all: true },
    }),
    prisma.offerwallConversion.groupBy({
      by: ["offerId"],
      where: { publisherId, createdAt: range },
      _count: { _all: true },
      _sum: { payout: true },
    }),
  ]);
  const names = await offerwallNames(publisherId, [
    ...new Set([...clicks.map((c) => c.offerId), ...conversions.map((c) => c.offerId)]),
  ]);
  const acc = offerAccumulator("offerwall");
  for (const c of clicks) {
    acc.add(c.offerId, names.get(c.offerId) ?? c.offerId, { clicks: c._count._all });
  }
  for (const c of conversions) {
    acc.add(c.offerId, names.get(c.offerId) ?? c.offerId, {
      conversions: c._count._all,
      earnings: Number(c._sum.payout ?? 0),
    });
  }
  return acc.rows();
}

async function taskTopOffers(publisherId: string, from: Date, to: Date) {
  const submissions = await prisma.publisherTaskSubmission.findMany({
    where: { publisherId, createdAt: { gte: from, lte: to } },
    select: { taskId: true, status: true, rewardAmount: true, task: { select: { title: true } } },
  });
  const acc = offerAccumulator("tasks");
  for (const s of submissions) {
    const approved = s.status === "APPROVED";
    acc.add(s.taskId, s.task.title, {
      clicks: 1,
      conversions: approved ? 1 : 0,
      earnings: approved ? Number(s.rewardAmount) : 0,
    });
  }
  return acc.rows();
}

const TOP_OFFER_LOADERS: Record<
  OfferSource,
  (publisherId: string, from: Date, to: Date) => Promise<OfferTotals[]>
> = {
  digital: digitalTopOffers,
  cpa: cpaTopOffers,
  offerwall: offerwallTopOffers,
  tasks: taskTopOffers,
};

async function topOffers(
  publisherId: string,
  source: PublisherDashboardSource,
  from: Date,
  to: Date,
): Promise<DashboardTopOffer[]> {
  const loaders = source === "all" ? Object.values(TOP_OFFER_LOADERS) : [TOP_OFFER_LOADERS[source]];
  const rows = (await Promise.all(loaders.map((load) => load(publisherId, from, to)))).flat();
  return rows
    .filter((r) => r.clicks > 0 || r.conversions > 0)
    .sort((a, b) => b.earnings - a.earnings || b.clicks - a.clicks)
    .slice(0, 5)
    .map((r) => ({ ...r, cr: r.clicks > 0 ? (r.conversions / r.clicks) * 100 : 0 }));
}

export type DashboardConversionStatus = "Pending" | "Approved" | "Rejected" | "Failed" | "Refunded";

export type DashboardRecentConversion = {
  source: OfferSource;
  name: string;
  amount: number;
  date: string;
  status: DashboardConversionStatus;
};

const RECENT_LIMIT = 5;

function digitalConversionStatus(row: {
  orderType: string;
  webhookStatus: string;
  paymentStatus: string | null;
}): DashboardConversionStatus {
  const status = row.webhookStatus.toUpperCase();
  if (
    status === REFUNDED_WEBHOOK_STATUS ||
    row.orderType === "Refund" ||
    (row.paymentStatus ?? "").toLowerCase().includes("refund")
  ) {
    return "Refunded";
  }
  if (status === "PROCESSED") return "Approved";
  if (status === "FAILED") return "Failed";
  return "Pending";
}

async function digitalRecent(publisherId: string): Promise<DashboardRecentConversion[]> {
  const report = await getPublisherCommissionReport({ publisherId, limit: RECENT_LIMIT });
  return report.items.map((row) => ({
    source: "digital",
    name: row.product ?? "Digital product",
    amount: row.commission ?? 0,
    date: row.date,
    status: digitalConversionStatus(row),
  }));
}

async function cpaRecent(publisherId: string): Promise<DashboardRecentConversion[]> {
  const rows = await prisma.cpaOfferConversion.findMany({
    where: { clickRecord: { publisherId } },
    orderBy: { createdAt: "desc" },
    take: RECENT_LIMIT,
    select: { createdAt: true, payout: true, offer: { select: { name: true } } },
  });
  return rows.map((row) => ({
    source: "cpa",
    name: row.offer.name,
    amount: Number(row.payout ?? 0),
    date: row.createdAt.toISOString(),
    status: "Approved",
  }));
}

async function offerwallRecent(publisherId: string): Promise<DashboardRecentConversion[]> {
  const rows = await prisma.offerwallConversion.findMany({
    where: { publisherId },
    orderBy: { createdAt: "desc" },
    take: RECENT_LIMIT,
    select: { offerId: true, payout: true, createdAt: true },
  });
  const names = await offerwallNames(publisherId, [...new Set(rows.map((r) => r.offerId))]);
  return rows.map((row) => ({
    source: "offerwall",
    name: names.get(row.offerId) ?? row.offerId,
    amount: Number(row.payout),
    date: row.createdAt.toISOString(),
    status: "Approved",
  }));
}

const TASK_STATUS: Record<string, DashboardConversionStatus> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

async function taskRecent(publisherId: string): Promise<DashboardRecentConversion[]> {
  const rows = await prisma.publisherTaskSubmission.findMany({
    where: { publisherId },
    orderBy: { createdAt: "desc" },
    take: RECENT_LIMIT,
    select: { createdAt: true, status: true, rewardAmount: true, task: { select: { title: true } } },
  });
  return rows.map((row) => ({
    source: "tasks",
    name: row.task.title,
    amount: Number(row.rewardAmount),
    date: row.createdAt.toISOString(),
    status: TASK_STATUS[row.status] ?? "Pending",
  }));
}

const RECENT_LOADERS: Record<OfferSource, (publisherId: string) => Promise<DashboardRecentConversion[]>> = {
  digital: digitalRecent,
  cpa: cpaRecent,
  offerwall: offerwallRecent,
  tasks: taskRecent,
};

async function recentConversions(
  publisherId: string,
  source: PublisherDashboardSource,
): Promise<DashboardRecentConversion[]> {
  const loaders = source === "all" ? Object.values(RECENT_LOADERS) : [RECENT_LOADERS[source]];
  const rows = (await Promise.all(loaders.map((load) => load(publisherId)))).flat();
  return rows
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, RECENT_LIMIT);
}

async function referralsOverview(
  publisherId: string,
  current: { from: Date; to: Date },
  previous: { from: Date; to: Date },
) {
  const [referralCode, total, active, newCurrent, newPrevious, earnings] = await Promise.all([
    ensureReferralCode(publisherId),
    prisma.user.count({ where: { referredById: publisherId } }),
    prisma.user.count({ where: { referredById: publisherId, status: "ACTIVE" } }),
    prisma.user.count({
      where: { referredById: publisherId, createdAt: { gte: current.from, lte: current.to } },
    }),
    prisma.user.count({
      where: { referredById: publisherId, createdAt: { gte: previous.from, lt: previous.to } },
    }),
    getPublisherReferralEarnings(publisherId),
  ]);
  return {
    referralCode,
    total,
    totalTrend: calcTrend(newCurrent, newPrevious),
    active,
    totalEarnings: earnings.total,
    pendingEarnings: earnings.uninvoiced,
  };
}

export async function getAffsensePublisherDashboard(
  publisherId: string,
  period: PublisherDashboardPeriod = "30d",
  source: PublisherDashboardSource = "all",
) {
  await reconcilePublisherLeadCreditsForUser(publisherId);
  await reconcilePublisherReferralCommissions(publisherId);

  const from = periodStart(period);
  const to = new Date();
  const prev = previousPeriodBounds(period);

  const [
    wallet,
    current,
    previous,
    pendingEarnings,
    offers,
    recent,
    referrals,
    announcements,
  ] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: publisherId } }),
    sourceMetrics(publisherId, source, from, to),
    sourceMetrics(publisherId, source, prev.from, prev.to),
    getUninvoicedTotalForPublisher(publisherId),
    topOffers(publisherId, source, from, to),
    recentConversions(publisherId, source),
    referralsOverview(publisherId, { from, to }, prev),
    listPublishedAnnouncements("PUBLISHER", 6),
  ]);

  const availableBalance = wallet
    ? Number(wallet.balance) - Number(wallet.holdBalance)
    : 0;

  return {
    period,
    source,
    cards: {
      clicks: current.clicks,
      clicksTrend: calcTrend(current.clicks, previous.clicks),
      conversions: current.conversions,
      conversionsTrend: calcTrend(current.conversions, previous.conversions),
      earnings: current.earnings,
      earningsTrend: calcTrend(current.earnings, previous.earnings),
      pendingEarnings,
      availableBalance,
      series: dailySeries(current, from, to),
    },
    topOffers: offers,
    recentConversions: recent,
    referrals,
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

export type PublisherPerformanceDay = PerformanceRow & { date: string };

export type PublisherPerformanceReport = {
  kpis: PerformanceRow;
  series: PublisherPerformanceDay[];
};

export async function getPublisherPerformanceReport(
  publisherId: string,
  opts: { from: Date; to: Date; source: PerformanceSource },
): Promise<PublisherPerformanceReport> {
  const { from, to, source } = opts;
  const loaders = source === "all" ? [cpaMetrics, digitalMetrics] : [source === "cpa" ? cpaMetrics : digitalMetrics];
  const parts = await Promise.all(loaders.map((load) => load(publisherId, from, to)));
  const merged = emptyMetrics();
  for (const part of parts) {
    for (const [key, bucket] of part.byDay) addToDay(merged, key, bucket);
  }

  return {
    kpis: withPerformanceRatios({
      clicks: merged.clicks,
      conversions: merged.conversions,
      earnings: merged.earnings,
    }),
    series: dailySeries(merged, from, to).map((day) => withPerformanceRatios(day)),
  };
}
