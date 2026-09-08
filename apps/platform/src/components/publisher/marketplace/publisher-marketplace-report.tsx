"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Activity, DollarSign, Filter, Search, ShoppingCart } from "lucide-react";
import { PageHero } from "@/components/admin/page-hero";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { formatCurrency } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  DigitalProductClickListResult,
  DigitalProductOrderRow,
  DigitalProductOrderSummary,
} from "@/services/digital-product.service";

const PAGE_SIZE = 20;

type ReportTab = "orders" | "clicks";

type AppliedFilters = {
  q: string;
  productId: string;
  subId: string;
  from: string;
  to: string;
};

const emptyFilters: AppliedFilters = {
  q: "",
  productId: "",
  subId: "",
  from: "",
  to: "",
};

type OrdersResult = {
  items: DigitalProductOrderRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: DigitalProductOrderSummary;
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

export function PublisherMarketplaceReport() {
  const [tab, setTab] = useState<ReportTab>("orders");
  const [ordersResult, setOrdersResult] = useState<OrdersResult | null>(null);
  const [clickResult, setClickResult] = useState<DigitalProductClickListResult | null>(null);
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
    if (applied.productId.trim()) params.set("productId", applied.productId.trim());
    if (applied.subId.trim()) params.set("subId", applied.subId.trim());
    if (applied.from.trim()) params.set("from", new Date(applied.from).toISOString());
    if (applied.to.trim()) {
      const end = new Date(applied.to);
      end.setHours(23, 59, 59, 999);
      params.set("to", end.toISOString());
    }

    const endpoint =
      tab === "clicks"
        ? `/api/v1/publisher/digital-products/clicks?${params}`
        : `/api/v1/publisher/digital-products/orders?${params}`;
    const res = await fetch(endpoint);
    const body = await res.json().catch(() => ({}));
    if (tab === "clicks") {
      setClickResult(body.data ?? null);
    } else {
      setOrdersResult(body.data ?? null);
    }
    setLoading(false);
  }, [page, applied, tab]);

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

  function onTabChange(next: string | number | null) {
    const value = String(next ?? "orders") as ReportTab;
    if (value !== "orders" && value !== "clicks") return;
    setTab(value);
    setPage(1);
  }

  const orderItems = ordersResult?.items ?? [];
  const clickItems = clickResult?.items ?? [];
  const total = tab === "clicks" ? (clickResult?.total ?? 0) : (ordersResult?.total ?? 0);
  const totalPages =
    tab === "clicks" ? (clickResult?.totalPages ?? 1) : (ordersResult?.totalPages ?? 1);
  const summary = ordersResult?.summary;
  const clickStats = clickResult?.stats;
  const rangeLabel =
    applied.from || applied.to
      ? [applied.from || "…", applied.to || "…"].join(" → ")
      : "All time";
  const noun = tab === "clicks" ? "clicks" : "orders";

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Marketplace"
        title="Report Log"
        description="Orders and clicks from your digital product tracking links."
        badge={loading ? undefined : `${total} ${noun} · ${rangeLabel}`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <NeutralStatCard
          label="Hits / Clicks"
          value={
            loading && !clickResult
              ? "…"
              : `${clickStats?.hits ?? 0} / ${clickStats?.clicks ?? 0}`
          }
          icon={Activity}
          accent="green"
        />
        <GradientStatCard
          label="Orders"
          value={loading && !ordersResult ? "…" : (summary?.totalOrders ?? 0).toLocaleString()}
          icon={ShoppingCart}
          variant="leads"
        />
        <GradientStatCard
          label="Sales"
          value={
            loading && !ordersResult
              ? "…"
              : formatCurrency(Number(summary?.grossRevenue ?? 0))
          }
          icon={DollarSign}
          variant="revenue"
        />
        <GradientStatCard
          label="Commissions"
          value={
            loading && !ordersResult
              ? "…"
              : formatCurrency(Number(summary?.totalCommissions ?? 0))
          }
          icon={DollarSign}
          variant="approved"
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
            <p className="text-xs text-white/75">Narrow by date, product, or search</p>
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
              <label className="text-xs font-medium text-muted-foreground">Product</label>
              <Input
                value={draft.productId}
                onChange={(e) => setDraft((prev) => ({ ...prev, productId: e.target.value }))}
                placeholder="Product ID or name"
                className="bg-white"
              />
            </div>
            <div className="w-full space-y-1 sm:w-44">
              <label className="text-xs font-medium text-muted-foreground">Sub ID</label>
              <Input
                value={draft.subId}
                onChange={(e) => setDraft((prev) => ({ ...prev, subId: e.target.value }))}
                placeholder="Sub ID"
                className="bg-white font-mono text-xs"
              />
            </div>
            <div className="min-w-48 flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="bg-white pl-9"
                  value={draft.q}
                  onChange={(e) => setDraft((prev) => ({ ...prev, q: e.target.value }))}
                  placeholder="Order, product, source…"
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

      <Tabs value={tab} onValueChange={onTabChange} className="gap-4">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start rounded-none border-b border-border bg-transparent p-0"
        >
          <TabsTrigger
            value="orders"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-active:border-primary data-active:bg-transparent data-active:shadow-none"
          >
            Orders
          </TabsTrigger>
          <TabsTrigger
            value="clicks"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-active:border-primary data-active:bg-transparent data-active:shadow-none"
          >
            Clicks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-0">
          <ReportCard
            title="Orders log"
            loading={loading}
            itemsLength={orderItems.length}
            total={ordersResult?.total ?? 0}
            page={page}
            totalPages={ordersResult?.totalPages ?? 1}
            noun="orders"
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/90 hover:bg-muted/90">
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Sub ID</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      Loading orders…
                    </TableCell>
                  </TableRow>
                ) : orderItems.length === 0 ? (
                  <EmptyRow colSpan={8} label="No orders found" />
                ) : (
                  orderItems.map((row) => (
                    <TableRow key={row.id} className="hover:bg-sky-50/40">
                      <TableCell className="whitespace-nowrap text-sm">
                        <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
                          {formatDateTime(row.date)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{cellValue(row.product)}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{row.orderId}</p>
                      </TableCell>
                      <TableCell>{cellValue(row.orderType)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.amount != null ? formatCurrency(row.amount) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.commission != null ? formatCurrency(row.commission) : "—"}
                      </TableCell>
                      <TableCell>{cellValue(row.source)}</TableCell>
                      <TableCell className="font-mono text-xs">{cellValue(row.subId)}</TableCell>
                      <TableCell>{cellValue(row.webhookStatus)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="clicks" className="mt-0">
          <ReportCard
            title="Click log"
            loading={loading}
            itemsLength={clickItems.length}
            total={clickResult?.total ?? 0}
            page={page}
            totalPages={clickResult?.totalPages ?? 1}
            noun="clicks"
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/90 hover:bg-muted/90">
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Click ID</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Sub ID</TableHead>
                  <TableHead>Campaign</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                      Loading clicks…
                    </TableCell>
                  </TableRow>
                ) : clickItems.length === 0 ? (
                  <EmptyRow colSpan={9} label="No clicks found" />
                ) : (
                  clickItems.map((row) => (
                    <TableRow key={row.id} className="hover:bg-sky-50/40">
                      <TableCell className="whitespace-nowrap text-sm">
                        <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
                          {formatDateTime(row.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{row.productName}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          #{row.productId.slice(-8)}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-40 truncate font-mono text-xs">
                        <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-700" title={row.id}>
                          {row.id}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{cellValue(row.ip)}</TableCell>
                      <TableCell>{row.device}</TableCell>
                      <TableCell>{row.browser}</TableCell>
                      <TableCell>{cellValue(row.src)}</TableCell>
                      <TableCell className="font-mono text-xs">{cellValue(row.subId)}</TableCell>
                      <TableCell>{cellValue(row.campaign)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ReportCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <Activity className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Try widening the date range or clearing filters.
        </p>
      </TableCell>
    </TableRow>
  );
}

function ReportCard({
  title,
  loading,
  itemsLength,
  total,
  page,
  totalPages,
  noun,
  onPrev,
  onNext,
  children,
}: {
  title: string;
  loading: boolean;
  itemsLength: number;
  total: number;
  page: number;
  totalPages: number;
  noun: string;
  onPrev: () => void;
  onNext: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-gradient-to-r from-sky-50 via-white to-emerald-50 px-5 py-3.5">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Loading…"
              : `Showing ${itemsLength} of ${total} ${noun} · page ${page} of ${totalPages}`}
          </p>
        </div>
      </div>
      {children}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-border bg-muted/50 px-5 py-3">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1 || loading} onClick={onPrev}>
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={onNext}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
