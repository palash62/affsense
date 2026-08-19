"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { FilterX, Search } from "lucide-react";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "SUCCESS", label: "Success" },
  { value: "FAILED", label: "Failed" },
  { value: "SKIPPED", label: "Skipped" },
  { value: "PENDING", label: "Pending" },
] as const;

export function PublisherPostbackReportFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") ?? defaultCampaignDateFrom());
  const [dateTo, setDateTo] = useState(searchParams.get("to") ?? defaultCampaignDateTo());

  const applyFilters = useCallback(
    (
      overrides?: Partial<{
        q: string;
        status: string;
        from: string;
        to: string;
      }>,
    ) => {
      const params = new URLSearchParams(searchParams.toString());

      const values = {
        q: (overrides?.q ?? search).trim(),
        status: overrides?.status ?? status,
        from: overrides?.from ?? dateFrom,
        to: overrides?.to ?? dateTo,
      };

      if (values.q) params.set("q", values.q);
      else params.delete("q");

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
    [search, status, dateFrom, dateTo, pathname, router, searchParams],
  );

  function clearFilters() {
    const from = defaultCampaignDateFrom();
    const to = defaultCampaignDateTo();
    setSearch("");
    setStatus("all");
    setDateFrom(from);
    setDateTo(to);
    startTransition(() => {
      router.push(`${pathname}?from=${from}&to=${to}`);
    });
  }

  const hasFilters =
    searchParams.has("q") ||
    searchParams.has("status") ||
    (searchParams.has("from") && searchParams.get("from") !== defaultCampaignDateFrom()) ||
    (searchParams.has("to") && searchParams.get("to") !== defaultCampaignDateTo());

  return (
    <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
      <div className="flex w-full flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Lead ID or URL"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="h-8 w-full rounded-md border-slate-200 bg-white pl-8 text-xs"
          />
        </div>

        <Select
          value={status}
          onValueChange={(v) => {
            if (!v) return;
            setStatus(v);
            applyFilters({ status: v });
          }}
        >
          <SelectTrigger className="h-8 w-[140px] rounded-md border-slate-200 bg-white text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex shrink-0 items-center gap-1.5">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-[132px] rounded-md border-slate-200 bg-white text-xs"
          />
          <span className="text-xs text-slate-400">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-[132px] rounded-md border-slate-200 bg-white text-xs"
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
              className="h-8 gap-1 rounded-md border-slate-200 bg-white px-2.5 text-xs"
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
