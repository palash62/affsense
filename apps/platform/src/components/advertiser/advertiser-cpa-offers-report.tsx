"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CalendarRange, DollarSign, Filter, Search } from "lucide-react";
import { PageHero } from "@/components/admin/page-hero";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
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
import type { CpaConversionListResult } from "@/services/cpa-offer.service";

const PAGE_SIZE = 20;

type AppliedFilters = {
  q: string;
  offerId: string;
  from: string;
  to: string;
};

const emptyFilters: AppliedFilters = {
  q: "",
  offerId: "",
  from: "",
  to: "",
};

function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function cellValue(value: string | null | undefined) {
  if (value == null || value === "") return "—";
  return value;
}

export function AdvertiserCpaOffersReport() {
  const [result, setResult] = useState<CpaConversionListResult | null>(null);
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
    if (applied.from.trim()) params.set("from", new Date(applied.from).toISOString());
    if (applied.to.trim()) {
      const end = new Date(applied.to);
      end.setHours(23, 59, 59, 999);
      params.set("to", end.toISOString());
    }

    const res = await fetch(`/api/v1/advertiser/cpa-offers/conversions?${params}`);
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

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const stats = result?.stats;

  const pageStats = useMemo(() => {
    const payoutSum = items.reduce((sum, row) => sum + Number(row.payout ?? 0), 0);
    const uniqueOffers = new Set(items.map((row) => row.offerId)).size;
    const withClickId = items.filter((row) => Boolean(row.clickId)).length;
    return { payoutSum, uniqueOffers, withClickId };
  }, [items]);

  const rangeLabel =
    applied.from || applied.to
      ? [applied.from || "…", applied.to || "…"].join(" → ")
      : "All time";

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="CPA Offers"
        title="Report"
        description="Conversion postbacks by offer, click ID, and earnings."
        badge={loading ? undefined : `${total} conversions · ${rangeLabel}`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <NeutralStatCard
          label="Hits / Clicks"
          value={loading ? "…" : `${stats?.hits ?? 0} / ${stats?.clicks ?? 0}`}
          icon={Activity}
          accent="green"
        />
        <GradientStatCard
          label="Conversions A | P | R"
          value={
            loading
              ? "…"
              : `${stats?.conversionsApproved ?? 0} | ${stats?.conversionsPending ?? 0} | ${stats?.conversionsRejected ?? 0}`
          }
          icon={Activity}
          variant="approved"
        />
        <GradientStatCard
          label="Earnings"
          value={loading ? "…" : formatCurrency(Number(stats?.payout ?? 0))}
          icon={DollarSign}
          variant="revenue"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <NeutralStatCard
          label="Rows shown"
          value={loading ? "…" : items.length}
          icon={Filter}
          accent="purple"
        />
        <NeutralStatCard
          label="With click ID"
          value={loading ? "…" : pageStats.withClickId}
          icon={Activity}
          accent="green"
        />
        <NeutralStatCard
          label="Date range"
          value={rangeLabel}
          icon={CalendarRange}
          accent="orange"
        />
      </div>

      <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-sm">
        <div
          className="flex items-center gap-2 px-5 py-3.5 text-white"
          style={{
            backgroundImage: "linear-gradient(135deg, var(--theme-hero-from), var(--theme-hero-to))",
          }}
        >
          <Filter className="h-4 w-4 text-white/80" />
          <div>
            <p className="text-sm font-semibold">Filters</p>
            <p className="text-xs text-white/75">Narrow conversions by date, offer, or search</p>
          </div>
        </div>

        <div className="space-y-3 bg-gradient-to-br from-slate-50/80 to-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="w-full space-y-1 sm:w-48">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input
                type="date"
                value={draft.from}
                onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value }))}
                className="bg-white"
              />
            </div>
            <div className="w-full space-y-1 sm:w-48">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input
                type="date"
                value={draft.to}
                onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
                className="bg-white"
              />
            </div>
            <div className="w-full space-y-1 sm:w-52">
              <label className="text-xs font-medium text-muted-foreground">Offer ID</label>
              <Input
                value={draft.offerId}
                onChange={(e) => setDraft((prev) => ({ ...prev, offerId: e.target.value }))}
                placeholder="Offer ID"
                className="bg-white"
              />
            </div>
            <div className="min-w-[12rem] flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="bg-white pl-9"
                  value={draft.q}
                  onChange={(e) => setDraft((prev) => ({ ...prev, q: e.target.value }))}
                  placeholder="Offer name or click ID"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyFilters();
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={applyFilters}>
                Apply
              </Button>
              <Button type="button" variant="outline" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-gradient-to-r from-sky-50 via-white to-emerald-50 px-5 py-3.5">
          <div>
            <p className="text-sm font-semibold text-foreground">Conversion log</p>
            <p className="text-xs text-muted-foreground">
              {loading
                ? "Loading…"
                : `Showing ${items.length} of ${total} conversions · page ${page} of ${totalPages}`}
            </p>
          </div>
          {!loading && total > 0 ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              Page earnings {formatCurrency(pageStats.payoutSum)}
            </span>
          ) : null}
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/90 hover:bg-muted/90">
              <TableHead>Date</TableHead>
              <TableHead>Offer</TableHead>
              <TableHead>Click ID</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Browser</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Sub ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Earnings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
                  Loading conversions…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <Activity className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No conversions found</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try widening the date range or clearing filters.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id} className="hover:bg-sky-50/40">
                  <TableCell className="whitespace-nowrap text-sm text-foreground">
                    <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
                      {formatDateTime(row.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <CpaOfferStatusDot status={row.offerStatus} />
                      <div>
                        <p className="font-medium text-foreground">{row.offerName}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          #{row.offerId.slice(-8)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[10rem] truncate font-mono text-xs text-muted-foreground">
                    {row.clickId ? (
                      <span
                        className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-700"
                        title={row.clickId}
                      >
                        {row.clickId}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell
                    className="max-w-[8rem] truncate font-mono text-xs text-muted-foreground"
                    title={row.ip ?? undefined}
                  >
                    {cellValue(row.ip)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-foreground">
                    {row.device}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-foreground">
                    {row.browser}
                  </TableCell>
                  <TableCell
                    className="max-w-[8rem] truncate text-sm text-foreground"
                    title={row.source ?? undefined}
                  >
                    {cellValue(row.source)}
                  </TableCell>
                  <TableCell
                    className="max-w-[8rem] truncate font-mono text-xs text-muted-foreground"
                    title={row.subId ?? undefined}
                  >
                    {cellValue(row.subId)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {row.status === "A" ? (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        A
                      </span>
                    ) : row.status === "P" ? (
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        P
                      </span>
                    ) : (
                      <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                        R
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.payout ? (
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-emerald-700">
                        {formatCurrency(Number(row.payout))}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border bg-muted/50 px-5 py-3">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
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

