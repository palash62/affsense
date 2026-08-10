"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { RotateCcw, Search } from "lucide-react";
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

export function AdminReportsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [view, setView] = useState(searchParams.get("view") ?? "publishers");
  const [sort, setSort] = useState(searchParams.get("sort") ?? "leads");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") ?? defaultCampaignDateFrom());
  const [dateTo, setDateTo] = useState(searchParams.get("to") ?? defaultCampaignDateTo());

  const applyFilters = useCallback(
    (overrides?: Partial<{ q: string; view: string; sort: string; from: string; to: string }>) => {
      const params = new URLSearchParams(searchParams.toString());
      const values = {
        q: overrides?.q ?? search,
        view: overrides?.view ?? view,
        sort: overrides?.sort ?? sort,
        from: overrides?.from ?? dateFrom,
        to: overrides?.to ?? dateTo,
      };

      if (values.q.trim()) params.set("q", values.q.trim());
      else params.delete("q");

      if (values.view && values.view !== "publishers") params.set("view", values.view);
      else params.delete("view");

      if (values.sort && values.sort !== "leads") params.set("sort", values.sort);
      else params.delete("sort");

      if (values.from) params.set("from", values.from);
      else params.delete("from");

      if (values.to) params.set("to", values.to);
      else params.delete("to");

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [search, view, sort, dateFrom, dateTo, pathname, router, searchParams],
  );

  function resetFilters() {
    setSearch("");
    setView("publishers");
    setSort("leads");
    setDateFrom(defaultCampaignDateFrom());
    setDateTo(defaultCampaignDateTo());
    startTransition(() => {
      router.push(pathname);
    });
  }

  return (
    <div className="space-y-3 border-b border-border bg-muted/50 px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Search account</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="Name or email..."
              className="h-9 bg-white pl-9"
            />
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">View</label>
            <Select
              value={view}
              onValueChange={(v) => {
                if (!v) return;
                setView(v);
                applyFilters({ view: v });
              }}
            >
              <SelectTrigger className="h-9 w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="publishers">Publishers</SelectItem>
                <SelectItem value="advertisers">Advertisers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Sort by</label>
            <Select
              value={sort}
              onValueChange={(v) => {
                if (!v) return;
                setSort(v);
                applyFilters({ sort: v });
              }}
            >
              <SelectTrigger className="h-9 w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="leads">Leads</SelectItem>
                <SelectItem value="clicks">Clicks</SelectItem>
                <SelectItem value="conversion">Conversion rate</SelectItem>
                <SelectItem value="spend">Spend / earnings</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => applyFilters()}
          disabled={isPending}
          className="h-8 bg-[var(--theme-primary)] hover:opacity-90"
        >
          {isPending ? "Applying..." : "Apply filters"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={resetFilters} className="h-8 gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
    </div>
  );
}
