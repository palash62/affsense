"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { FilterX } from "lucide-react";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import { formatPublisherOptionLabel } from "@/lib/payout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeadExportButton } from "@/components/leads/lead-export-button";

const SELECT_TRIGGER_CLASS =
  "h-8 !w-full min-w-0 bg-card text-xs *:data-[slot=select-value]:line-clamp-none";

const SELECT_MENU_CLASS = "z-200 !w-[22rem] max-w-[calc(100vw-2rem)]";

const LABEL_CLASS = "text-xs font-medium text-muted-foreground";

type CampaignOption = { id: string; name: string };
type AdvertiserOption = { id: string; name: string };
type PublisherOption = {
  id: string;
  name: string;
  email: string;
  publisherProfile?: { website: string | null } | null;
};

const STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "CAPTURED", label: "Captured" },
  { value: "VALIDATING", label: "Validating" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "PAID", label: "Paid" },
] as const;

function normalizeSelectValue(value: string | null, allowed: string[]) {
  if (!value) return "all";
  return allowed.includes(value) ? value : "all";
}

export function AdminLeadDetailsFilters({
  campaigns,
  advertisers,
  publishers,
}: {
  campaigns: CampaignOption[];
  advertisers: AdvertiserOption[];
  publishers: PublisherOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [advertiserId, setAdvertiserId] = useState(() =>
    normalizeSelectValue(searchParams.get("advertiserId"), ["all", ...advertisers.map((a) => a.id)]),
  );
  const [campaignId, setCampaignId] = useState(() =>
    normalizeSelectValue(searchParams.get("campaignId"), ["all", ...campaigns.map((c) => c.id)]),
  );
  const [publisherId, setPublisherId] = useState(() =>
    normalizeSelectValue(searchParams.get("publisherId"), ["all", ...publishers.map((p) => p.id)]),
  );
  const [status, setStatus] = useState(() =>
    normalizeSelectValue(searchParams.get("status"), STATUSES.map((s) => s.value)),
  );
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") ?? defaultCampaignDateFrom());
  const [dateTo, setDateTo] = useState(searchParams.get("to") ?? defaultCampaignDateTo());

  const applyFilters = useCallback(
    (
      overrides?: Partial<{
        advertiserId: string;
        campaignId: string;
        publisherId: string;
        status: string;
        from: string;
        to: string;
      }>,
    ) => {
      const params = new URLSearchParams(searchParams.toString());

      const values = {
        advertiserId: overrides?.advertiserId ?? advertiserId,
        campaignId: overrides?.campaignId ?? campaignId,
        publisherId: overrides?.publisherId ?? publisherId,
        status: overrides?.status ?? status,
        from: overrides?.from ?? dateFrom,
        to: overrides?.to ?? dateTo,
      };

      if (values.advertiserId && values.advertiserId !== "all") {
        params.set("advertiserId", values.advertiserId);
      } else {
        params.delete("advertiserId");
      }

      if (values.campaignId && values.campaignId !== "all") params.set("campaignId", values.campaignId);
      else params.delete("campaignId");

      if (values.publisherId && values.publisherId !== "all") {
        params.set("publisherId", values.publisherId);
      } else {
        params.delete("publisherId");
      }

      if (values.status && values.status !== "all") params.set("status", values.status);
      else params.delete("status");

      if (values.from) params.set("from", values.from);
      else params.delete("from");

      if (values.to) params.set("to", values.to);
      else params.delete("to");

      params.delete("page");

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [
      advertiserId,
      campaignId,
      publisherId,
      status,
      dateFrom,
      dateTo,
      pathname,
      router,
      searchParams,
    ],
  );

  function clearFilters() {
    const from = defaultCampaignDateFrom();
    const to = defaultCampaignDateTo();
    setAdvertiserId("all");
    setCampaignId("all");
    setPublisherId("all");
    setStatus("all");
    setDateFrom(from);
    setDateTo(to);
    startTransition(() => {
      router.push(`${pathname}?from=${from}&to=${to}`);
    });
  }

  const hasFilters =
    searchParams.has("advertiserId") ||
    searchParams.has("campaignId") ||
    searchParams.has("publisherId") ||
    searchParams.has("status") ||
    searchParams.has("sort") ||
    (searchParams.has("page") && searchParams.get("page") !== "1");

  return (
    <div className="border-b border-border bg-muted/80 px-4 py-2.5">
      <div className="flex w-full flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1 space-y-1">
          <label className={LABEL_CLASS}>Advertiser</label>
          <Select
            value={advertiserId}
            onValueChange={(value) => {
              if (!value) return;
              setAdvertiserId(value);
              applyFilters({ advertiserId: value });
            }}
          >
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="All advertisers" />
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false} className={SELECT_MENU_CLASS}>
              <SelectItem value="all">All advertisers</SelectItem>
              {advertisers.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[200px] flex-1 space-y-1">
          <label className={LABEL_CLASS}>Campaign</label>
          <Select
            value={campaignId}
            onValueChange={(value) => {
              if (!value) return;
              setCampaignId(value);
              applyFilters({ campaignId: value });
            }}
          >
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="All campaigns" />
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false} className={SELECT_MENU_CLASS}>
              <SelectItem value="all">All campaigns</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[180px] flex-1 space-y-1">
          <label className={LABEL_CLASS}>Publisher</label>
          <Select
            value={publisherId}
            onValueChange={(value) => {
              if (!value) return;
              setPublisherId(value);
              applyFilters({ publisherId: value });
            }}
          >
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="All publishers" />
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false} className={SELECT_MENU_CLASS}>
              <SelectItem value="all">All publishers</SelectItem>
              {publishers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {formatPublisherOptionLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[160px] space-y-1">
          <label className={LABEL_CLASS}>Status</label>
          <Select
            value={status}
            onValueChange={(value) => {
              if (!value) return;
              setStatus(value);
              applyFilters({ status: value });
            }}
          >
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false} className={SELECT_MENU_CLASS}>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex shrink-0 items-end gap-1.5">
          <div className="space-y-1">
            <label className={LABEL_CLASS}>From</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-[132px] rounded-md border-border bg-card text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className={LABEL_CLASS}>To</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-[132px] rounded-md border-border bg-card text-xs"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 pb-0.5">
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
          <LeadExportButton />
        </div>
      </div>
    </div>
  );
}
