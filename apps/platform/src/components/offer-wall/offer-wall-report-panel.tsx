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
  OfferWallReportResult,
  SerializedOfferWallReportRow,
} from "@/services/offer-wall-report.service";

const PAGE_SIZE = 20;

type AppliedFilters = {
  q: string;
  offerId: string;
  subId: string;
  publisherId: string;
  from: string;
  to: string;
};

const emptyFilters: AppliedFilters = {
  q: "",
  offerId: "",
  subId: "",
  publisherId: "",
  from: "",
  to: "",
};

export function OfferWallReportPanel({
  apiPath,
  title,
  description,
  eyebrow,
  showPublisherFilter = false,
  showNetworkPayout = false,
}: {
  apiPath: string;
  title: string;
  description: string;
  eyebrow: string;
  showPublisherFilter?: boolean;
  showNetworkPayout?: boolean;
}) {
  const [result, setResult] = useState<OfferWallReportResult | null>(null);
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
    if (showPublisherFilter && applied.publisherId.trim()) {
      params.set("publisherId", applied.publisherId.trim());
    }
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
  }, [apiPath, page, applied, showPublisherFilter]);

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

  const items = (result?.items ?? []) as SerializedOfferWallReportRow[];
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
        eyebrow={eyebrow}
        title={title}
        description={description}
        badge={loading ? undefined : `${total} offers · ${rangeLabel}`}
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
            <Input
              placeholder="Publisher ID"
              value={draft.publisherId}
              onChange={(e) => setDraft((d) => ({ ...d, publisherId: e.target.value }))}
            />
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

      <div className="overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]">
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
                <TableCell colSpan={showNetworkPayout ? 7 : 6} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showNetworkPayout ? 7 : 6} className="text-muted-foreground">
                  No Offer Wall activity for this range.
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
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
