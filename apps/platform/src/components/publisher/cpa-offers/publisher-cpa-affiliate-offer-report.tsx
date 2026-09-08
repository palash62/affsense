"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarRange,
  DollarSign,
  Filter,
  MousePointerClick,
  Percent,
  Search,
  Target,
} from "lucide-react";
import { PageHero } from "@/components/admin/page-hero";
import {
  GradientStatCard,
  NeutralStatCard,
} from "@/components/admin/gradient-stat-card";
import { formatCurrency } from "@/components/admin/admin-ui";
import { CpaOfferStatusDot } from "@/components/cpa/cpa-offer-thumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  CpaAffiliateOfferReportResult,
  SerializedCpaAffiliateOfferReportRow,
} from "@/services/cpa-offer.service";

const PAGE_SIZE = 20;

type AppliedFilters = {
  q: string;
  offerId: string;
  subId: string;
  from: string;
  to: string;
};

const emptyFilters: AppliedFilters = {
  q: "",
  offerId: "",
  subId: "",
  from: "",
  to: "",
};

export function PublisherCpaAffiliateOfferReport() {
  const [result, setResult] = useState<CpaAffiliateOfferReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<AppliedFilters>(emptyFilters);
  const [applied, setApplied] = useState<AppliedFilters>(emptyFilters);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (applied.q.trim()) params.set("q", applied.q.trim());
    if (applied.offerId.trim()) params.set("offerId", applied.offerId.trim());
    if (applied.subId.trim()) params.set("subId", applied.subId.trim());
    if (applied.from.trim()) params.set("from", new Date(applied.from).toISOString());
    if (applied.to.trim()) {
      const end = new Date(applied.to);
      end.setHours(23, 59, 59, 999);
      params.set("to", end.toISOString());
    }

    const res = await fetch(
      `/api/v1/publisher/cpa-offers/affiliate-offer-report?${params}`,
    );
    const body = await res.json().catch(() => ({}));
    setResult(body.data ?? null);
    setLoading(false);
  }, [page, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters() {
    setPage(1);
    setApplied({ ...draft });
  }

  function clearFilters() {
    setDraft(emptyFilters);
    setApplied(emptyFilters);
    setPage(1);
  }

  const items = (result?.items ?? []) as SerializedCpaAffiliateOfferReportRow[];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const stats = result?.stats;

  const rangeLabel = useMemo(() => {
    if (applied.from && applied.to) return `${applied.from} → ${applied.to}`;
    if (applied.from) return `From ${applied.from}`;
    if (applied.to) return `Until ${applied.to}`;
    return "All time";
  }, [applied.from, applied.to]);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="CPA Offers"
        title="Report"
        description="Your offer performance — clicks, conversions, conversion rate, and EPC."
        badge={loading ? undefined : `${total} rows · ${rangeLabel}`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <NeutralStatCard
          label="Clicks"
          value={loading ? "…" : (stats?.clicks ?? 0)}
          icon={MousePointerClick}
          accent="green"
        />
        <NeutralStatCard
          label="Conversions"
          value={loading ? "…" : (stats?.conversions ?? 0)}
          icon={Target}
          accent="purple"
        />
        <NeutralStatCard
          label="CR / EPC"
          value={
            loading
              ? "…"
              : `${(stats?.conversionRate ?? 0).toFixed(2)}% / ${formatCurrency(Number(stats?.epc ?? 0))}`
          }
          icon={Percent}
          accent="orange"
        />
        <GradientStatCard
          label="Earnings"
          value={loading ? "…" : formatCurrency(Number(stats?.payout ?? 0))}
          icon={DollarSign}
          variant="revenue"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <NeutralStatCard
          label="Rows shown"
          value={loading ? "…" : items.length}
          icon={Filter}
          accent="purple"
        />
        <NeutralStatCard
          label="Date range"
          value={rangeLabel}
          icon={CalendarRange}
          accent="green"
        />
      </div>

      <div className="rounded-[18px] border border-border bg-card shadow-sm">
        <div
          className="flex items-center gap-2 rounded-t-[18px] px-5 py-3.5 text-white"
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--theme-hero-from), var(--theme-hero-to))",
          }}
        >
          <Filter className="h-4 w-4 text-white/80" />
          <div>
            <p className="text-sm font-semibold">Filters</p>
            <p className="text-xs text-white/75">Narrow by date, offer, or search</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-50/80 to-white p-4">
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-12">
            <div className="space-y-1 xl:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input
                type="date"
                className="h-9 bg-white"
                value={draft.from}
                onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value }))}
              />
            </div>
            <div className="space-y-1 xl:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input
                type="date"
                className="h-9 bg-white"
                value={draft.to}
                onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
              />
            </div>
            <div className="space-y-1 xl:col-span-3">
              <label className="text-xs font-medium text-muted-foreground">Offer ID</label>
              <Input
                className="h-9 bg-white font-mono text-xs"
                placeholder="Optional"
                value={draft.offerId}
                onChange={(e) => setDraft((prev) => ({ ...prev, offerId: e.target.value }))}
              />
            </div>
            <div className="space-y-1 xl:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Sub ID</label>
              <Input
                className="h-9 bg-white font-mono text-xs"
                placeholder="Optional"
                value={draft.subId}
                onChange={(e) => setDraft((prev) => ({ ...prev, subId: e.target.value }))}
              />
            </div>
            <div className="space-y-1 sm:col-span-2 xl:col-span-3">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 bg-white pl-8"
                  placeholder="Offer name…"
                  value={draft.q}
                  onChange={(e) => setDraft((prev) => ({ ...prev, q: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyFilters();
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={applyFilters}>
              Apply
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
              Clear
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Offer</TableHead>
              <TableHead>Sub ID</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">Conversions</TableHead>
              <TableHead className="text-right">CR%</TableHead>
              <TableHead className="text-right">EPC</TableHead>
              <TableHead className="text-right">Payout</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <Activity className="h-8 w-8 text-muted-foreground/50" />
                    <p>No offer rows for these filters.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={`${row.publisherId}:${row.offerId}:${row.subId ?? ""}`}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      {row.offerStatus ? <CpaOfferStatusDot status={row.offerStatus} /> : null}
                      <div>
                        <p className="font-medium text-foreground">{row.offerName}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          #{row.offerId.slice(-8)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.subId ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.clicks}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.conversions}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.conversionRate.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(Number(row.epc))}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-emerald-700">
                      {formatCurrency(Number(row.payout))}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} · {total} rows
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
