"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  CalendarRange,
  ChevronDown,
  DollarSign,
  Filter,
  Search,
  Store,
  X,
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
import { formatAdvertiserOptionLabel } from "@/lib/deposit";
import { cn } from "@/lib/utils";
import type { CpaConversionListResult } from "@/services/cpa-offer.service";

const PAGE_SIZE = 20;

type AdvertiserOption = {
  id: string;
  name: string;
  email: string;
  advertiserProfile?: { company: string } | null;
};

type AppliedFilters = {
  q: string;
  offerId: string;
  advertiserId: string;
  from: string;
  to: string;
};

const emptyFilters: AppliedFilters = {
  q: "",
  offerId: "",
  advertiserId: "",
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

function formatRawQuery(raw: unknown) {
  if (raw == null) return "—";
  if (typeof raw === "string") return raw.length > 80 ? `${raw.slice(0, 80)}…` : raw;
  try {
    const text = JSON.stringify(raw);
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  } catch {
    return "—";
  }
}

function AdvertiserSearchSelect({
  advertisers,
  value,
  onChange,
}: {
  advertisers: AdvertiserOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 288);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    setCoords({
      top: rect.bottom + 4,
      left,
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onReposition() {
      updatePosition();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePosition]);

  const selected = useMemo(
    () => advertisers.find((a) => a.id === value) ?? null,
    [advertisers, value],
  );

  const suggestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return advertisers;
    return advertisers.filter((a) => {
      const haystack = [
        a.name,
        a.email,
        a.advertiserProfile?.company ?? "",
        a.id,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [advertisers, search]);

  const panel =
    open && mounted && coords
      ? createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              minWidth: "18rem",
              maxWidth: "min(22rem, calc(100vw - 16px))",
            }}
            className="z-[100] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          >
            <div className="border-b border-slate-100 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, company, email…"
                  className="h-8 w-full rounded-md border border-slate-200 bg-slate-50/80 py-1 pr-2 pl-8 text-sm outline-none focus:border-slate-300 focus:bg-white"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              <button
                type="button"
                className={cn(
                  "flex w-full px-3 py-2 text-left text-sm hover:bg-slate-50",
                  !value && "bg-sky-50 font-medium text-sky-800",
                )}
                onClick={() => {
                  onChange("");
                  setSearch("");
                  setOpen(false);
                }}
              >
                All advertisers
              </button>
              {suggestions.length === 0 ? (
                <p className="px-3 py-3 text-xs text-slate-500">No advertisers match</p>
              ) : (
                suggestions.map((advertiser) => (
                  <button
                    key={advertiser.id}
                    type="button"
                    className={cn(
                      "flex w-full px-3 py-2 text-left text-sm hover:bg-slate-50",
                      value === advertiser.id && "bg-sky-50 font-medium text-sky-800",
                    )}
                    onClick={() => {
                      onChange(advertiser.id);
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{formatAdvertiserOptionLabel(advertiser)}</span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-white px-3 text-left text-sm shadow-xs outline-none transition-[color,box-shadow]",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          open && "border-ring ring-[3px] ring-ring/50",
        )}
      >
        <span className={cn("min-w-0 truncate", !selected && "text-slate-400")}>
          {selected ? formatAdvertiserOptionLabel(selected) : "All advertisers"}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {selected ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear advertiser"
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setSearch("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                  setSearch("");
                }
              }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {panel}
    </div>
  );
}

export function AdminCpaOffersReport({
  advertisers,
}: {
  advertisers: AdvertiserOption[];
}) {
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
    if (applied.advertiserId.trim()) params.set("advertiserId", applied.advertiserId.trim());
    if (applied.from.trim()) params.set("from", new Date(applied.from).toISOString());
    if (applied.to.trim()) {
      const end = new Date(applied.to);
      end.setHours(23, 59, 59, 999);
      params.set("to", end.toISOString());
    }

    const res = await fetch(`/api/v1/admin/cpa-offers/conversions?${params}`);
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

  const appliedAdvertiser = useMemo(
    () => advertisers.find((a) => a.id === applied.advertiserId) ?? null,
    [advertisers, applied.advertiserId],
  );

  const rangeLabel =
    applied.from || applied.to
      ? [applied.from || "…", applied.to || "…"].join(" → ")
      : "All time";

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="CPA Offers"
        title="Report"
        description="Conversion postbacks by offer, advertiser, click ID, and payout."
        badge={loading ? undefined : `${total} conversions · ${rangeLabel}`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
          label="Revenue | Payout"
          value={
            loading
              ? "…"
              : `${formatCurrency(Number(stats?.revenue ?? 0))} / ${formatCurrency(Number(stats?.payout ?? 0))}`
          }
          icon={DollarSign}
          variant="revenue"
        />
        <NeutralStatCard
          label="Profit"
          value={loading ? "…" : formatCurrency(Number(stats?.profit ?? 0))}
          icon={DollarSign}
          accent="orange"
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
          label={appliedAdvertiser ? "Advertiser" : "Date range"}
          value={
            appliedAdvertiser
              ? appliedAdvertiser.advertiserProfile?.company?.trim() ||
                appliedAdvertiser.name
              : rangeLabel
          }
          icon={appliedAdvertiser ? Store : CalendarRange}
          accent="orange"
        />
      </div>

      <div className="rounded-[18px] border border-slate-200/80 bg-white shadow-sm">
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
            <p className="text-xs text-white/75">
              Narrow conversions by advertiser, date, offer, or search
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-50/80 to-white p-4">
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-12">
            <div className="space-y-1 sm:col-span-2 xl:col-span-3">
              <label className="text-xs font-medium text-slate-500">Advertiser</label>
              <AdvertiserSearchSelect
                advertisers={advertisers}
                value={draft.advertiserId}
                onChange={(advertiserId) =>
                  setDraft((prev) => ({ ...prev, advertiserId }))
                }
              />
            </div>
            <div className="space-y-1 xl:col-span-2">
              <label className="text-xs font-medium text-slate-500">From</label>
              <Input
                type="date"
                value={draft.from}
                onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value }))}
                className="h-9 bg-white"
              />
            </div>
            <div className="space-y-1 xl:col-span-2">
              <label className="text-xs font-medium text-slate-500">To</label>
              <Input
                type="date"
                value={draft.to}
                onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
                className="h-9 bg-white"
              />
            </div>
            <div className="space-y-1 xl:col-span-1">
              <label className="text-xs font-medium text-slate-500">Offer ID</label>
              <Input
                value={draft.offerId}
                onChange={(e) => setDraft((prev) => ({ ...prev, offerId: e.target.value }))}
                placeholder="Offer ID"
                className="h-9 bg-white"
              />
            </div>
            <div className="space-y-1 sm:col-span-2 xl:col-span-2">
              <label className="text-xs font-medium text-slate-500">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-9 bg-white pl-9"
                  value={draft.q}
                  onChange={(e) => setDraft((prev) => ({ ...prev, q: e.target.value }))}
                  placeholder="Offer, advertiser, or click ID"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyFilters();
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-2 xl:justify-end">
              <Button type="button" className="h-9" onClick={applyFilters}>
                Apply
              </Button>
              <Button type="button" variant="outline" className="h-9" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-sky-50 via-white to-emerald-50 px-5 py-3.5">
          <div>
            <p className="text-sm font-semibold text-slate-900">Conversion log</p>
            <p className="text-xs text-slate-500">
              {loading
                ? "Loading…"
                : `Showing ${items.length} of ${total} conversions · page ${page} of ${totalPages}`}
            </p>
          </div>
          {!loading && total > 0 ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              Page payout {formatCurrency(pageStats.payoutSum)}
            </span>
          ) : null}
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/90 hover:bg-slate-50/90">
              <TableHead>Date</TableHead>
              <TableHead>Advertiser</TableHead>
              <TableHead>Offer</TableHead>
              <TableHead>Click ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Payout</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead>Raw</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-slate-500">
                  Loading conversions…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <Activity className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">No conversions found</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Try widening the date range or clearing filters.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id} className="hover:bg-sky-50/40">
                  <TableCell className="whitespace-nowrap text-sm text-slate-700">
                    <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
                      {formatDateTime(row.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {row.advertiserName ? (
                      <div>
                        <p className="font-medium text-slate-900">{row.advertiserName}</p>
                        {row.advertiserId ? (
                          <p className="font-mono text-[11px] text-slate-400">
                            #{row.advertiserId.slice(-8)}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <CpaOfferStatusDot status={row.offerStatus} />
                      <div>
                        <p className="font-medium text-slate-900">{row.offerName}</p>
                        <p className="font-mono text-[11px] text-slate-400">
                          #{row.offerId.slice(-8)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[10rem] truncate font-mono text-xs text-slate-600">
                    {row.clickId ? (
                      <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-700">
                        {row.clickId}
                      </span>
                    ) : (
                      "—"
                    )}
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
                    {row.payout != null ? (
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-emerald-700">
                        {formatCurrency(Number(row.payout))}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.revenue != null ? (
                      <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-sky-700">
                        {formatCurrency(Number(row.revenue))}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell
                    className="max-w-[14rem] truncate font-mono text-[11px] text-slate-400"
                    title={
                      typeof row.rawQuery === "string"
                        ? row.rawQuery
                        : JSON.stringify(row.rawQuery ?? "")
                    }
                  >
                    {formatRawQuery(row.rawQuery)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3">
            <p className="text-xs text-slate-500">
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
