"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DollarSign,
  MousePointerClick,
  Percent,
  Target,
} from "lucide-react";
import { PageHero } from "@/components/admin/page-hero";
import {
  GradientStatCard,
  NeutralStatCard,
} from "@/components/admin/gradient-stat-card";
import { formatCurrency } from "@/components/admin/admin-ui";
import {
  AffiliateSearchSelect,
  type SelectedAffiliate,
} from "@/components/admin/affiliate-search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  OfferWallReportGroupBy,
  OfferWallReportResult,
  SerializedOfferWallAffiliateRow,
  SerializedOfferWallReportRow,
} from "@/services/offer-wall-report.service";

const PAGE_SIZE = 20;

type AppliedFilters = {
  q: string;
  offerId: string;
  subId: string;
  affiliate: SelectedAffiliate | null;
  from: string;
  to: string;
};

const emptyFilters: AppliedFilters = {
  q: "",
  offerId: "",
  subId: "",
  affiliate: null,
  from: "",
  to: "",
};

const TAB_TRIGGER_CLASS =
  "rounded-none border-b-2 border-transparent px-4 py-2.5 data-active:border-primary data-active:bg-transparent data-active:shadow-none";

export function OfferWallReportPanel({
  apiPath,
  title,
  description,
  eyebrow,
  showPublisherFilter = false,
  showNetworkPayout = false,
  showAffiliateView = false,
}: {
  apiPath: string;
  title: string;
  description: string;
  eyebrow: string;
  showPublisherFilter?: boolean;
  showNetworkPayout?: boolean;
  showAffiliateView?: boolean;
}) {
  const [result, setResult] = useState<OfferWallReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<AppliedFilters>(emptyFilters);
  const [applied, setApplied] = useState<AppliedFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [groupBy, setGroupBy] = useState<OfferWallReportGroupBy>("offer");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (applied.q.trim()) params.set("q", applied.q.trim());
    if (applied.offerId.trim()) params.set("offerId", applied.offerId.trim());
    if (applied.subId.trim()) params.set("subId", applied.subId.trim());
    if (showPublisherFilter && applied.affiliate) {
      params.set("publisherId", applied.affiliate.id);
    }
    if (showAffiliateView && groupBy === "affiliate") params.set("groupBy", "affiliate");
    if (applied.from.trim()) params.set("from", new Date(applied.from).toISOString());
    if (applied.to.trim()) {
      const end = new Date(applied.to);
      end.setHours(23, 59, 59, 999);
      params.set("to", end.toISOString());
    }

    const res = await fetch(`${apiPath}?${params}`);
    const body = await res.json().catch(() => ({}));
    setResult(body.data ?? null);
    setLoading(false);
  }, [apiPath, page, applied, showPublisherFilter, showAffiliateView, groupBy]);

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
    const value = String(next ?? "offer");
    if (value !== "offer" && value !== "affiliate") return;
    setGroupBy(value);
    setPage(1);
  }

  function drillIntoAffiliate(row: SerializedOfferWallAffiliateRow) {
    const affiliate: SelectedAffiliate = {
      id: row.publisherId,
      name: row.publisherName ?? row.publisherId,
      email: row.publisherEmail ?? "",
      memberId: row.memberId ?? undefined,
    };
    setDraft((d) => ({ ...d, affiliate }));
    setApplied((a) => ({ ...a, affiliate }));
    setGroupBy("offer");
    setPage(1);
  }

  const resultGroupBy = result?.groupBy ?? "offer";
  const isAffiliateTable = showAffiliateView && resultGroupBy === "affiliate";
  const offerItems = (isAffiliateTable ? [] : (result?.items ?? [])) as SerializedOfferWallReportRow[];
  const affiliateItems = (isAffiliateTable ? (result?.items ?? []) : []) as SerializedOfferWallAffiliateRow[];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const stats = result?.stats;

  const rangeLabel = useMemo(() => {
    if (applied.from && applied.to) return `${applied.from} → ${applied.to}`;
    if (applied.from) return `From ${applied.from}`;
    if (applied.to) return `Until ${applied.to}`;
    return "All time";
  }, [applied.from, applied.to]);

  const offerColSpan = showNetworkPayout ? 7 : 6;
  const affiliateColSpan = showNetworkPayout ? 8 : 7;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow={eyebrow}
        title={title}
        description={description}
        badge={
          loading
            ? undefined
            : `${total} ${isAffiliateTable ? "affiliates" : "offers"} · ${rangeLabel}`
        }
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

      {showNetworkPayout ? (
        <p className="text-xs text-muted-foreground">
          Network payout (gross):{" "}
          <span className="font-medium text-foreground">
            {loading ? "…" : formatCurrency(Number(stats?.networkPayout ?? 0))}
          </span>
        </p>
      ) : null}

      <div className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <Input
            placeholder="Search offer / sub ID"
            value={draft.q}
            onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
          />
          <Input
            placeholder="Offer ID"
            value={draft.offerId}
            onChange={(e) => setDraft((d) => ({ ...d, offerId: e.target.value }))}
          />
          <Input
            placeholder="Sub ID"
            value={draft.subId}
            onChange={(e) => setDraft((d) => ({ ...d, subId: e.target.value }))}
          />
          {showPublisherFilter ? (
            <div className="sm:col-span-2 lg:col-span-1 xl:col-span-1">
              <AffiliateSearchSelect
                value={draft.affiliate}
                onChange={(affiliate) => setDraft((d) => ({ ...d, affiliate }))}
                placeholder="All affiliates"
              />
            </div>
          ) : null}
          <Input
            type="date"
            value={draft.from}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
          />
          <Input
            type="date"
            value={draft.to}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" onClick={applyFilters}>
            Apply
          </Button>
          <Button type="button" variant="outline" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </div>

      {showAffiliateView ? (
        <Tabs value={groupBy} onValueChange={onTabChange}>
          <TabsList
            variant="line"
            className="h-auto w-full justify-start rounded-none border-b border-border bg-transparent p-0"
          >
            <TabsTrigger value="offer" className={TAB_TRIGGER_CLASS}>
              By offer
            </TabsTrigger>
            <TabsTrigger value="affiliate" className={TAB_TRIGGER_CLASS}>
              By affiliate
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      <div className="overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]">
        {isAffiliateTable ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Affiliate</TableHead>
                <TableHead className="text-right">Offers</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Conv.</TableHead>
                <TableHead className="text-right">CR</TableHead>
                <TableHead className="text-right">EPC</TableHead>
                <TableHead className="text-right">Payout</TableHead>
                {showNetworkPayout ? (
                  <TableHead className="text-right">Network</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={affiliateColSpan} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : affiliateItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={affiliateColSpan} className="text-muted-foreground">
                    No Offer Wall activity for this range.
                  </TableCell>
                </TableRow>
              ) : (
                affiliateItems.map((row) => (
                  <TableRow
                    key={row.publisherId}
                    className="cursor-pointer hover:bg-muted/50"
                    title="View this affiliate's offers"
                    onClick={() => drillIntoAffiliate(row)}
                  >
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {row.publisherName || row.publisherId}
                        </p>
                        {row.publisherEmail ? (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {row.publisherEmail}
                          </p>
                        ) : null}
                        {row.memberId ? (
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {row.memberId}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.offers}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.clicks}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.conversions}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.conversionRate.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.epc)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-[var(--theme-success)]">
                      {formatCurrency(row.payout)}
                    </TableCell>
                    {showNetworkPayout ? (
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.networkPayout)}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Offer</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Conv.</TableHead>
                <TableHead className="text-right">CR</TableHead>
                <TableHead className="text-right">EPC</TableHead>
                <TableHead className="text-right">Payout</TableHead>
                {showNetworkPayout ? (
                  <TableHead className="text-right">Network</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={offerColSpan} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : offerItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={offerColSpan} className="text-muted-foreground">
                    No Offer Wall activity for this range.
                  </TableCell>
                </TableRow>
              ) : (
                offerItems.map((row) => (
                  <TableRow key={row.offerId}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {row.offerName || row.offerId}
                        </p>
                        <p className="font-mono text-[11px] text-muted-foreground">{row.offerId}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.clicks}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.conversions}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.conversionRate.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.epc)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-[var(--theme-success)]">
                      {formatCurrency(row.payout)}
                    </TableCell>
                    {showNetworkPayout ? (
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.networkPayout)}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
