import { findSoloCampaignMismatches, findSoloWalletMismatches, utcDate } from "@cpl/tracking-core";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";

export type SoloReportGroup = "campaign" | "provider" | "day";

export type SoloReportRow = {
  key: string;
  label: string;
  clicks: number;
  billedClicks: number;
  invalidClicks: number;
  spendCents: number;
  leads: number;
  conversions: number;
  commissionCents: number;
  reversedCents: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function resolveSoloReportRange(from?: string | null, to?: string | null, defaultDays = 30) {
  const now = new Date();
  const end = to && DATE_RE.test(to) ? to : utcDate(now);
  const start = from && DATE_RE.test(from) ? from : utcDate(new Date(Date.parse(`${end}T00:00:00Z`) - (defaultDays - 1) * DAY_MS));
  if (start > end) throw Errors.validation("The start date must be before the end date", "from");
  if (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`) > 366 * DAY_MS) {
    throw Errors.validation("Reports can cover at most one year", "from");
  }
  return { from: start, to: end };
}

type Sum = Partial<Record<Exclude<keyof SoloReportRow, "key" | "label">, number | null>>;

/** commissionCents in rows is net of reversals (stats keep gross commission and reversals separately). */
function toRow(key: string, label: string, s: Sum | undefined): SoloReportRow {
  return {
    key,
    label,
    clicks: s?.clicks ?? 0,
    billedClicks: s?.billedClicks ?? 0,
    invalidClicks: s?.invalidClicks ?? 0,
    spendCents: s?.spendCents ?? 0,
    leads: s?.leads ?? 0,
    conversions: s?.conversions ?? 0,
    commissionCents: (s?.commissionCents ?? 0) - (s?.reversedCents ?? 0),
    reversedCents: s?.reversedCents ?? 0,
  };
}

export function sumSoloRows(rows: SoloReportRow[]): SoloReportRow {
  return rows.reduce(
    (acc, r) => ({
      ...acc,
      clicks: acc.clicks + r.clicks,
      billedClicks: acc.billedClicks + r.billedClicks,
      invalidClicks: acc.invalidClicks + r.invalidClicks,
      spendCents: acc.spendCents + r.spendCents,
      leads: acc.leads + r.leads,
      conversions: acc.conversions + r.conversions,
      commissionCents: acc.commissionCents + r.commissionCents,
      reversedCents: acc.reversedCents + r.reversedCents,
    }),
    toRow("total", "Total", undefined),
  );
}

const SUM_FIELDS = {
  clicks: true,
  billedClicks: true,
  invalidClicks: true,
  spendCents: true,
  leads: true,
  conversions: true,
  commissionCents: true,
  reversedCents: true,
} as const;

/** Publisher report from campaign-local daily stats. Providers are only ever identified by publicCode. */
export async function getSoloPublisherReport(
  publisherId: string,
  input: { from?: string | null; to?: string | null; groupBy?: string | null; campaignId?: string | null },
) {
  const range = resolveSoloReportRange(input.from, input.to);
  const groupBy: SoloReportGroup =
    input.groupBy === "provider" || input.groupBy === "day" ? input.groupBy : "campaign";
  const where = {
    localDate: { gte: range.from, lte: range.to },
    campaign: { publisherId },
    ...(input.campaignId ? { campaignId: input.campaignId } : {}),
  };

  let rows: SoloReportRow[];
  if (groupBy === "campaign") {
    const grouped = await prisma.soloDailyStats.groupBy({ by: ["campaignId"], where, _sum: SUM_FIELDS });
    const campaigns = await prisma.soloCampaign.findMany({
      where: { id: { in: grouped.map((g) => g.campaignId) }, publisherId },
      select: { id: true, name: true },
    });
    const names = new Map(campaigns.map((c) => [c.id, c.name]));
    rows = grouped.map((g) => toRow(g.campaignId, names.get(g.campaignId) ?? "Deleted campaign", g._sum));
  } else if (groupBy === "provider") {
    const grouped = await prisma.soloDailyStats.groupBy({ by: ["providerId"], where, _sum: SUM_FIELDS });
    const providers = await prisma.soloProvider.findMany({
      where: { id: { in: grouped.map((g) => g.providerId) } },
      select: { id: true, publicCode: true },
    });
    const codes = new Map(providers.map((p) => [p.id, p.publicCode]));
    rows = grouped.map((g) => {
      const code = codes.get(g.providerId);
      return toRow(String(code ?? "unknown"), code ? `Provider #${code}` : "Provider", g._sum);
    });
  } else {
    const grouped = await prisma.soloDailyStats.groupBy({ by: ["localDate"], where, _sum: SUM_FIELDS });
    rows = grouped.map((g) => toRow(g.localDate, g.localDate, g._sum));
  }

  rows.sort((a, b) => (groupBy === "day" ? b.key.localeCompare(a.key) : b.spendCents - a.spendCents));
  return { range, groupBy, rows, totals: sumSoloRows(rows) };
}

export async function getSoloPublisherOverview(publisherId: string) {
  const range = resolveSoloReportRange(null, null, 30);
  const [byStatus, last30, daily, recentCampaigns] = await Promise.all([
    prisma.soloCampaign.groupBy({ by: ["status"], where: { publisherId }, _count: { _all: true } }),
    prisma.soloDailyStats.aggregate({
      where: { campaign: { publisherId }, localDate: { gte: range.from, lte: range.to } },
      _sum: SUM_FIELDS,
    }),
    prisma.soloDailyStats.groupBy({
      by: ["localDate"],
      where: { campaign: { publisherId }, localDate: { gte: range.from, lte: range.to } },
      _sum: { billedClicks: true, spendCents: true, commissionCents: true },
      orderBy: { localDate: "asc" },
    }),
    prisma.soloCampaign.findMany({
      where: { publisherId, status: { in: ["ACTIVE", "PENDING_REVIEW", "INSUFFICIENT_FUNDS", "BUDGET_EXHAUSTED", "PAUSED"] } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        status: true,
        trafficType: true,
        spentCents: true,
        lifetimeBudgetCents: true,
        dailyBudgetCents: true,
        paidClicks: true,
        cpcCentsSnapshot: true,
      },
    }),
  ]);
  const statusCounts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Record<string, number>;
  return {
    range,
    statusCounts,
    totals: toRow("last30", "Last 30 days", last30._sum),
    daily: daily.map((d) => ({
      date: d.localDate,
      clicks: d._sum.billedClicks ?? 0,
      spendCents: d._sum.spendCents ?? 0,
      commissionCents: d._sum.commissionCents ?? 0,
    })),
    recentCampaigns,
  };
}

export async function getSoloAdminOverview() {
  const now = new Date();
  const range = resolveSoloReportRange(null, null, 30);
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const [clicks24h, stats30, wallets, deposits30, pendingReview, activeCampaigns, providers, walletMismatches, campaignMismatches, staleClicks] =
    await Promise.all([
      prisma.soloClick.groupBy({ by: ["billingStatus"], where: { createdAt: { gte: dayAgo } }, _count: { _all: true } }),
      prisma.soloDailyStats.aggregate({ where: { localDate: { gte: range.from, lte: range.to } }, _sum: SUM_FIELDS }),
      prisma.soloWallet.aggregate({ _sum: { balanceCents: true, reservedCents: true }, _count: { _all: true } }),
      prisma.soloDeposit.aggregate({
        where: { status: "SUCCEEDED", completedAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
      prisma.soloCampaign.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.soloCampaign.count({ where: { status: "ACTIVE" } }),
      prisma.soloProvider.count({ where: { status: "ACTIVE" } }),
      findSoloWalletMismatches(20),
      findSoloCampaignMismatches(20),
      prisma.soloClick.count({ where: { billingStatus: "PENDING", createdAt: { lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) } } }),
    ]);
  const clickCounts = Object.fromEntries(clicks24h.map((c) => [c.billingStatus, c._count._all])) as Record<string, number>;
  return {
    range,
    clicks24h: {
      total: Object.values(clickCounts).reduce((a, b) => a + b, 0),
      billed: clickCounts.BILLED ?? 0,
      pending: clickCounts.PENDING ?? 0,
      invalid: clickCounts.INVALID ?? 0,
      fallback: clickCounts.FALLBACK ?? 0,
      refunded: clickCounts.REFUNDED ?? 0,
    },
    totals30: toRow("last30", "Last 30 days", stats30._sum),
    liabilities: {
      balanceCents: wallets._sum.balanceCents ?? 0,
      reservedCents: wallets._sum.reservedCents ?? 0,
      wallets: wallets._count._all,
    },
    deposits30: { amountCents: deposits30._sum.amountCents ?? 0, count: deposits30._count._all },
    pendingReview,
    activeCampaigns,
    providers,
    walletMismatches,
    campaignMismatches,
    staleClicks,
  };
}

export async function getSoloTrafficQuality(input: { days?: number; status?: string | null; page?: number }) {
  const days = Math.min(90, Math.max(1, input.days ?? 7));
  const since = new Date(Date.now() - days * DAY_MS);
  const status = input.status === "BILLED" || input.status === "REFUNDED" || input.status === "FALLBACK" ? input.status : "INVALID";
  const page = Math.max(1, input.page ?? 1);
  const limit = 50;
  const [reasons, byProvider, clicks, total] = await Promise.all([
    prisma.soloClick.groupBy({
      by: ["invalidReason"],
      where: { createdAt: { gte: since }, billingStatus: { in: ["INVALID", "FALLBACK", "REFUNDED"] } },
      _count: { _all: true },
    }),
    prisma.soloClick.groupBy({
      by: ["providerId", "billingStatus"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.soloClick.findMany({
      where: { createdAt: { gte: since }, billingStatus: status },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        createdAt: true,
        providerId: true,
        campaignId: true,
        trafficType: true,
        country: true,
        device: true,
        billingStatus: true,
        invalidReason: true,
        chargeCents: true,
        campaign: { select: { name: true, publisher: { select: { email: true } } } },
      },
    }),
    prisma.soloClick.count({ where: { createdAt: { gte: since }, billingStatus: status } }),
  ]);
  const providers = await prisma.soloProvider.findMany({
    where: { id: { in: [...new Set(byProvider.map((p) => p.providerId))] } },
    select: { id: true, publicCode: true, realName: true },
  });
  const providerMap = new Map(providers.map((p) => [p.id, p]));
  const providerRows = [...new Set(byProvider.map((p) => p.providerId))].map((providerId) => {
    const rows = byProvider.filter((p) => p.providerId === providerId);
    const count = (s: string) => rows.find((r) => r.billingStatus === s)?._count._all ?? 0;
    const total = rows.reduce((a, r) => a + r._count._all, 0);
    return {
      providerId,
      publicCode: providerMap.get(providerId)?.publicCode ?? 0,
      realName: providerMap.get(providerId)?.realName ?? "Unknown",
      total,
      billed: count("BILLED"),
      invalid: count("INVALID"),
      fallback: count("FALLBACK"),
      refunded: count("REFUNDED"),
    };
  });
  providerRows.sort((a, b) => b.total - a.total);
  return {
    days,
    status,
    reasons: reasons
      .map((r) => ({ reason: r.invalidReason ?? "unspecified", count: r._count._all }))
      .sort((a, b) => b.count - a.count),
    providers: providerRows,
    clicks: clicks.map((c) => ({ ...c, provider: providerMap.get(c.providerId) ?? null })),
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    total,
  };
}
