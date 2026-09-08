"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  DollarSign,
  Filter,
  RefreshCcw,
  Search,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { DigitalProductOrdersTable } from "@/components/admin/digital-products/digital-product-orders-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type PublisherOption = { id: string; name: string; email: string };

type ReportTab = "orders" | "clicks";

type OrdersResult = {
  items: DigitalProductOrderRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: DigitalProductOrderSummary;
};

type AppliedFilters = {
  q: string;
  productId: string;
  subId: string;
  publisherId: string;
  eventType: string;
  from: string;
  to: string;
};

function formatUsd(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

export function AdminDigitalProductsReport({
  publishers,
  defaultFrom,
  defaultTo,
}: {
  publishers: PublisherOption[];
  defaultFrom: string;
  defaultTo: string;
}) {
  const emptyFilters = useMemo<AppliedFilters>(
    () => ({
      q: "",
      productId: "",
      subId: "",
      publisherId: "",
      eventType: "",
      from: defaultFrom,
      to: defaultTo,
    }),
    [defaultFrom, defaultTo],
  );

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
    params.set("limit", tab === "orders" ? "15" : "20");
    if (applied.publisherId.trim()) params.set("publisherId", applied.publisherId.trim());
    if (applied.subId.trim()) params.set("subId", applied.subId.trim());
    if (applied.from.trim()) {
      const from =
        tab === "orders"
          ? applied.from
          : new Date(applied.from).toISOString();
      params.set("from", from);
    }
    if (applied.to.trim()) {
      if (tab === "orders") {
        params.set("to", applied.to);
      } else {
        const end = new Date(applied.to);
        end.setHours(23, 59, 59, 999);
        params.set("to", end.toISOString());
      }
    }
    if (tab === "orders") {
      if (applied.eventType.trim()) params.set("eventType", applied.eventType.trim());
    } else {
      if (applied.q.trim()) params.set("q", applied.q.trim());
      if (applied.productId.trim()) params.set("productId", applied.productId.trim());
    }

    const endpoint =
      tab === "clicks"
        ? `/api/v1/admin/digital-products/clicks?${params}`
        : `/api/v1/admin/digital-products/orders?${params}`;
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

  const summary = ordersResult?.summary;
  const clickStats = clickResult?.stats;
  const orderItems = ordersResult?.items ?? [];
  const clickItems = clickResult?.items ?? [];
  const total = tab === "clicks" ? (clickResult?.total ?? 0) : (ordersResult?.total ?? 0);
  const totalPages =
    tab === "clicks" ? (clickResult?.totalPages ?? 1) : (ordersResult?.totalPages ?? 1);

  return (
    <div className="flex flex-col gap-5">
      <PageHero
        title="Digital Products Report Log"
        description="Orders and click events by product, affiliate, and traffic."
        eyebrow="Digital Products"
        badge={loading ? undefined : `${total} ${tab}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          label="Total Orders"
          value={
            loading && !ordersResult ? "…" : (summary?.totalOrders ?? 0).toLocaleString()
          }
          icon={ShoppingCart}
          variant="leads"
        />
        <GradientStatCard
          label="Gross Revenue"
          value={
            loading && !ordersResult ? "…" : formatUsd(summary?.grossRevenue ?? 0)
          }
          icon={DollarSign}
          variant="revenue"
        />
        <GradientStatCard
          label="Affiliate Sales"
          value={
            loading && !ordersResult
              ? "…"
              : (summary?.affiliateSales ?? 0).toLocaleString()
          }
          icon={Users}
          variant="approved"
        />
        <NeutralStatCard
          label="Total Commissions"
          value={
            loading && !ordersResult ? "…" : formatUsd(summary?.totalCommissions ?? 0)
          }
          icon={Wallet}
          accent="purple"
        />
        <NeutralStatCard
          label="Net Revenue"
          value={loading && !ordersResult ? "…" : formatUsd(summary?.netRevenue ?? 0)}
          icon={TrendingUp}
          accent="green"
        />
        <NeutralStatCard
          label="Refunds"
          value={loading && !ordersResult ? "…" : formatUsd(summary?.refunds ?? 0)}
          icon={RefreshCcw}
          accent="red"
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
            <p className="text-xs text-white/75">
              Narrow by publisher, date, product, or search
            </p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-slate-50/80 to-white p-4">
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-12">
            <div className="space-y-1 sm:col-span-2 xl:col-span-3">
              <label className="text-xs font-medium text-muted-foreground">Affiliate</label>
              <Select
                value={draft.publisherId || "all"}
                onValueChange={(v) =>
                  setDraft((prev) => ({ ...prev, publisherId: v === "all" ? "" : (v ?? "") }))
                }
              >
                <SelectTrigger className="h-9 w-full bg-white">
                  <SelectValue placeholder="All affiliates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All affiliates</SelectItem>
                  {publishers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 xl:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input
                type="date"
                value={draft.from}
                onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value }))}
                className="h-9 bg-white"
              />
            </div>
            <div className="space-y-1 xl:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input
                type="date"
                value={draft.to}
                onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
                className="h-9 bg-white"
              />
            </div>
            {tab === "orders" ? (
              <div className="space-y-1 xl:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Event type</label>
                <Select
                  value={draft.eventType || "all"}
                  onValueChange={(v) =>
                    setDraft((prev) => ({ ...prev, eventType: v === "all" ? "" : (v ?? "") }))
                  }
                >
                  <SelectTrigger className="h-9 w-full bg-white">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="purchase">Purchase</SelectItem>
                    <SelectItem value="upsell">Upsell</SelectItem>
                    <SelectItem value="downsell">Downsell</SelectItem>
                    <SelectItem value="refund">Refund</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="space-y-1 xl:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Product ID</label>
                  <Input
                    value={draft.productId}
                    onChange={(e) => setDraft((prev) => ({ ...prev, productId: e.target.value }))}
                    placeholder="Product ID"
                    className="h-9 bg-white"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2 xl:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Search</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-9 bg-white pl-9"
                      value={draft.q}
                      onChange={(e) => setDraft((prev) => ({ ...prev, q: e.target.value }))}
                      placeholder="Product, publisher, click ID…"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") applyFilters();
                      }}
                    />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-1 xl:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Sub ID</label>
              <Input
                value={draft.subId}
                onChange={(e) => setDraft((prev) => ({ ...prev, subId: e.target.value }))}
                placeholder="Sub ID"
                className="h-9 bg-white font-mono text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-1 xl:justify-end">
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
          <PageSection
            title="Orders"
            description={
              loading
                ? "Loading…"
                : `${(ordersResult?.total ?? 0).toLocaleString()} webhook events in range`
            }
            icon={BarChart3}
          >
            {loading ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">Loading orders…</p>
            ) : (
              <DigitalProductOrdersTable rows={orderItems} />
            )}
            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
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
          </PageSection>
        </TabsContent>

        <TabsContent value="clicks" className="mt-0">
          <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-gradient-to-r from-sky-50 via-white to-emerald-50 px-5 py-3.5">
              <div>
                <p className="text-sm font-semibold text-foreground">Click log</p>
                <p className="text-xs text-muted-foreground">
                  {loading
                    ? "Loading…"
                    : `Showing ${clickItems.length} of ${clickResult?.total ?? 0} clicks · page ${page} of ${totalPages}`}
                </p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/90 hover:bg-muted/90">
                  <TableHead>Date</TableHead>
                  <TableHead>Affiliate</TableHead>
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
                    <TableCell colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
                      Loading clicks…
                    </TableCell>
                  </TableRow>
                ) : clickItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
                      No clicks found
                    </TableCell>
                  </TableRow>
                ) : (
                  clickItems.map((row) => (
                    <TableRow key={row.id} className="hover:bg-sky-50/40">
                      <TableCell className="whitespace-nowrap">
                        <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
                          {formatDateTime(row.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.publisherName ? (
                          <div>
                            <p className="font-medium">{row.publisherName}</p>
                            <p className="text-[11px] text-muted-foreground">{row.publisherEmail}</p>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{row.productName}</p>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
