"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Store } from "lucide-react";
import { PageHero } from "@/components/admin/page-hero";
import { formatCurrency } from "@/components/admin/admin-ui";
import { CpaOfferStatusDot, CpaOfferThumb } from "@/components/cpa/cpa-offer-thumb";
import { ButtonLink } from "@/components/ui/button-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { AdvertiserCpaDashboardSnapshot, CpaDashboardRange } from "@/services/cpa-offer.service";

const RANGES: Array<{ id: CpaDashboardRange; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7d", label: "Last 7 Days" },
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
];

const EARNINGS_PERIODS: Array<{
  key: keyof NonNullable<AdvertiserCpaDashboardSnapshot["earningsByPeriod"]>;
  label: string;
}> = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7d", label: "Last 7 Days" },
  { key: "last30d", label: "Last 30 Days" },
];

function formatChange(pct: number) {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function formatRangeDates(from: string, to: string) {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
    return `${fmt.format(new Date(from))} – ${fmt.format(new Date(to))}`;
  } catch {
    return "";
  }
}

function MetricCard({
  title,
  changePct,
  children,
  sparkValues,
  accent,
}: {
  title: string;
  changePct: number;
  children: ReactNode;
  sparkValues: number[];
  accent: "emerald" | "sky" | "violet" | "orange";
}) {
  const accentBar = {
    emerald: "from-emerald-400 to-teal-500",
    sky: "from-sky-400 to-blue-500",
    violet: "from-violet-400 to-fuchsia-500",
    orange: "from-orange-400 to-amber-500",
  }[accent];

  const hasSpark = sparkValues.some((v) => v > 0);
  const max = Math.max(...sparkValues, 1);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", accentBar)} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            changePct > 0
              ? "text-emerald-600"
              : changePct < 0
                ? "text-red-500"
                : "text-muted-foreground",
          )}
        >
          {formatChange(changePct)}
        </span>
      </div>
      <div className="mt-2">{children}</div>
      <div className="mt-3 h-10">
        {hasSpark ? (
          <div className="flex h-full items-end gap-0.5">
            {sparkValues.map((v, i) => (
              <div
                key={i}
                className={cn(
                  "min-w-0 flex-1 rounded-t bg-gradient-to-t opacity-80",
                  accentBar,
                )}
                style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg bg-muted text-[11px] text-muted-foreground">
            No Data Available
          </div>
        )}
      </div>
    </div>
  );
}

export function AdvertiserCpaOffersDashboard() {
  const [range, setRange] = useState<CpaDashboardRange>("last7d");
  const [chartType, setChartType] = useState<"area" | "bar">("area");
  const [data, setData] = useState<AdvertiserCpaDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/advertiser/cpa-offers/dashboard?range=${range}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error?.message ?? "Failed to load dashboard");
      }
      setData(body.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const spark = useMemo(
    () => (data?.series ?? []).map((p) => p.conversions),
    [data],
  );

  const dailyTotals = useMemo(() => {
    const rows = data?.dailyStats ?? [];
    return {
      hops: rows.reduce((sum, row) => sum + row.hops, 0),
      sales: rows.reduce((sum, row) => sum + row.sales, 0),
      earnings: rows.reduce((sum, row) => sum + Number(row.earnings), 0),
      other: rows.reduce((sum, row) => sum + Number(row.other), 0),
    };
  }, [data]);

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="CPA Offers"
        title="Dashboard"
        description="Your CPA offer performance based on stored click + conversion data."
        badge={data ? data.rangeLabel : undefined}
      />

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Sales Dashboard</h2>
          <p className="text-xs text-muted-foreground">Earnings by period</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {EARNINGS_PERIODS.map((period) => (
            <div
              key={period.key}
              className="rounded-xl border border-border bg-card px-4 py-5 text-center shadow-sm"
            >
              <p className="text-sm font-semibold text-foreground">{period.label}</p>
              <p className="mt-3 text-2xl font-bold tabular-nums text-emerald-600 underline decoration-dotted decoration-slate-300 underline-offset-4">
                {loading
                  ? "…"
                  : formatCurrency(Number(data?.earningsByPeriod?.[period.key] ?? 0))}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">Affiliate Daily Stats</h2>
          <Link
            href="/advertiser/cpa-offers/report"
            className="text-sm font-medium text-[var(--theme-primary)] hover:underline"
          >
            More &gt;
          </Link>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/90 hover:bg-muted/90">
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Hops</TableHead>
              <TableHead className="text-right">Sales</TableHead>
              <TableHead className="text-right">Earnings</TableHead>
              <TableHead className="text-right">Other</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Loading daily stats…
                </TableCell>
              </TableRow>
            ) : !(data?.dailyStats?.length) ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No daily stats yet.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {data.dailyStats.map((row) => (
                  <TableRow key={row.date} className="hover:bg-sky-50/40">
                    <TableCell className="font-medium text-foreground">{row.date}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.hops}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.sales}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-emerald-600">
                      {formatCurrency(Number(row.earnings))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(Number(row.other))}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/80 font-semibold hover:bg-muted/80">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{dailyTotals.hops}</TableCell>
                  <TableCell className="text-right tabular-nums">{dailyTotals.sales}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-700">
                    {formatCurrency(dailyTotals.earnings)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCurrency(dailyTotals.other)}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-card p-1.5 shadow-sm">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                range === item.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/advertiser/cpa-offers/report" variant="outline" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Report
          </ButtonLink>
          <ButtonLink href="/advertiser/cpa-offers" className="gap-2">
            <Store className="h-4 w-4" />
            Offers
          </ButtonLink>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Hits / Clicks"
          changePct={data?.metrics.hitsClicksChangePct ?? 0}
          sparkValues={[]}
          accent="sky"
        >
          <p className="text-3xl font-bold tabular-nums text-foreground">
            {loading ? "…" : `${data?.metrics.hits ?? 0} / ${data?.metrics.clicks ?? 0}`}
          </p>
        </MetricCard>

        <MetricCard
          title="Conversions A | P | R"
          changePct={data?.metrics.conversionsChangePct ?? 0}
          sparkValues={spark}
          accent="emerald"
        >
          <p className="text-3xl font-bold tabular-nums text-emerald-600">
            {loading
              ? "…"
              : `${data?.metrics.conversionsApproved ?? 0} | ${data?.metrics.conversionsPending ?? 0} | ${data?.metrics.conversionsRejected ?? 0}`}
          </p>
        </MetricCard>

        <MetricCard
          title="Earnings"
          changePct={data?.metrics.payoutChangePct ?? 0}
          sparkValues={[]}
          accent="violet"
        >
          <p className="text-3xl font-bold tabular-nums text-emerald-600">
            {loading ? "…" : formatCurrency(Number(data?.metrics.payout ?? 0))}
          </p>
        </MetricCard>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {data?.rangeLabel ?? "Last 7 Days"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {data ? formatRangeDates(data.from, data.to) : "Loading…"}
            </p>
          </div>
          <div className="flex rounded-lg border border-border bg-muted p-0.5">
            {(["area", "bar"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setChartType(type)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors",
                  chartType === type
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[340px] w-full">
          {loading || !data ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading chart…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "area" ? (
                <AreaChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cpaConv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="cpaClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="cpaUnique" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#1e3a8a" fill="url(#cpaClicks)" strokeWidth={2} />
                  <Area
                    type="monotone"
                    dataKey="uniqueClicks"
                    name="Unique Clicks"
                    stroke="#22c55e"
                    fill="url(#cpaUnique)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="conversions"
                    name="Conversion"
                    stroke="#38bdf8"
                    fill="url(#cpaConv)"
                    strokeWidth={2}
                  />
                </AreaChart>
              ) : (
                <BarChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="clicks" name="Clicks" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="uniqueClicks" name="Unique Clicks" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="conversions" name="Conversion" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Hits/clicks come from stored CPA click records; conversion series comes from CPA conversion postbacks.
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div
          className="flex items-center justify-between px-5 py-4 text-white"
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--theme-hero-from), var(--theme-hero-to))",
          }}
        >
          <div>
            <h2 className="text-sm font-semibold">New Offers</h2>
            <p className="text-xs text-white/75">Latest offers added to the marketplace</p>
          </div>
          <Link
            href="/advertiser/cpa-offers"
            className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition hover:bg-white/25"
          >
            View all
          </Link>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/90 hover:bg-muted/90">
              <TableHead>Offer ID</TableHead>
              <TableHead>Offer</TableHead>
              <TableHead className="text-right">Payout</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                  Loading offers…
                </TableCell>
              </TableRow>
            ) : !data?.newOffers.length ? (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                  No offers yet.
                </TableCell>
              </TableRow>
            ) : (
              data.newOffers.map((offer) => (
                <TableRow key={offer.id} className="hover:bg-sky-50/40">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CpaOfferStatusDot status={offer.status} />
                      <span className="font-mono text-xs text-muted-foreground">{offer.id.slice(-6)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <CpaOfferThumb name={offer.name} thumbnailUrl={offer.thumbnailUrl} size="sm" />
                      <div className="min-w-0">
                        <Link
                          href={`/advertiser/cpa-offers/${offer.id}`}
                          className="block truncate font-medium text-foreground hover:text-[var(--theme-primary)]"
                        >
                          {offer.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                            {offer.payoutModel}
                          </span>
                          <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                            {offer.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(Number(offer.payout))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

