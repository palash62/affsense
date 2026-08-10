"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { FilterX, Search } from "lucide-react";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdvertiserLeadsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [campaignId, setCampaignId] = useState(searchParams.get("campaign") ?? "");
  const [publisherId, setPublisherId] = useState(searchParams.get("publisher") ?? "");
  const [payoutMin, setPayoutMin] = useState(searchParams.get("payoutMin") ?? "");
  const [payoutMax, setPayoutMax] = useState(searchParams.get("payoutMax") ?? "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") ?? defaultCampaignDateFrom());
  const [dateTo, setDateTo] = useState(searchParams.get("to") ?? defaultCampaignDateTo());

  const applyFilters = useCallback(
    (
      overrides?: Partial<{
        campaign: string;
        publisher: string;
        payoutMin: string;
        payoutMax: string;
        from: string;
        to: string;
      }>,
    ) => {
      const params = new URLSearchParams(searchParams.toString());

      const values = {
        campaign: (overrides?.campaign ?? campaignId).trim(),
        publisher: (overrides?.publisher ?? publisherId).trim(),
        payoutMin: (overrides?.payoutMin ?? payoutMin).trim(),
        payoutMax: (overrides?.payoutMax ?? payoutMax).trim(),
        from: overrides?.from ?? dateFrom,
        to: overrides?.to ?? dateTo,
      };

      if (values.campaign) params.set("campaign", values.campaign);
      else params.delete("campaign");

      if (values.publisher) params.set("publisher", values.publisher);
      else params.delete("publisher");

      if (values.payoutMin) params.set("payoutMin", values.payoutMin);
      else params.delete("payoutMin");

      if (values.payoutMax) params.set("payoutMax", values.payoutMax);
      else params.delete("payoutMax");

      if (values.from) params.set("from", values.from);
      else params.delete("from");

      if (values.to) params.set("to", values.to);
      else params.delete("to");

      params.delete("page");

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [campaignId, publisherId, payoutMin, payoutMax, dateFrom, dateTo, pathname, router, searchParams],
  );

  function clearFilters() {
    const from = defaultCampaignDateFrom();
    const to = defaultCampaignDateTo();
    setCampaignId("");
    setPublisherId("");
    setPayoutMin("");
    setPayoutMax("");
    setDateFrom(from);
    setDateTo(to);
    startTransition(() => {
      router.push(`${pathname}?from=${from}&to=${to}`);
    });
  }

  const hasFilters =
    searchParams.has("campaign") ||
    searchParams.has("publisher") ||
    searchParams.has("payoutMin") ||
    searchParams.has("payoutMax") ||
    searchParams.has("sort") ||
    (searchParams.has("page") && searchParams.get("page") !== "1");

  return (
    <div className="border-b border-border bg-muted/80 px-4 py-2.5">
      <div className="flex w-full flex-wrap items-center gap-2">
        <div className="relative min-w-[130px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Publisher ID"
            value={publisherId}
            onChange={(e) => setPublisherId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="h-8 w-full rounded-md border-border bg-white pl-8 text-xs"
          />
        </div>
        <div className="relative min-w-[130px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Campaign ID"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="h-8 w-full rounded-md border-border bg-white pl-8 text-xs"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Input
            type="number"
            min={0}
            step={0.01}
            placeholder="Min $"
            value={payoutMin}
            onChange={(e) => setPayoutMin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="h-8 w-[72px] rounded-md border-border bg-card text-xs"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="number"
            min={0}
            step={0.01}
            placeholder="Max $"
            value={payoutMax}
            onChange={(e) => setPayoutMax(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="h-8 w-[72px] rounded-md border-border bg-card text-xs"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-[132px] rounded-md border-border bg-card text-xs"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-[132px] rounded-md border-border bg-card text-xs"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => applyFilters()}
            disabled={isPending}
            className="h-8 rounded-md bg-[var(--theme-primary)] px-4 text-xs hover:opacity-90"
          >
            {isPending ? "..." : "Apply"}
          </Button>
          {hasFilters && (
            <Button
              size="sm"
              variant="outline"
              onClick={clearFilters}
              disabled={isPending}
              className="h-8 gap-1 rounded-md border-border bg-card px-2.5 text-xs"
            >
              <FilterX className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
