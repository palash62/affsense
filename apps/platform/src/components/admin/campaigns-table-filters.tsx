"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Search, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CampaignsTableFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [sort, setSort] = useState(searchParams.get("sort") ?? "created_desc");
  const [cplMin, setCplMin] = useState(searchParams.get("cplMin") ?? "");
  const [cplMax, setCplMax] = useState(searchParams.get("cplMax") ?? "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("to") ?? "");

  const applyFilters = useCallback(
    (overrides?: Partial<{
      q: string;
      status: string;
      sort: string;
      cplMin: string;
      cplMax: string;
      from: string;
      to: string;
    }>) => {
      const params = new URLSearchParams(searchParams.toString());

      const values = {
        q: overrides?.q ?? search,
        status: overrides?.status ?? status,
        sort: overrides?.sort ?? sort,
        cplMin: overrides?.cplMin ?? cplMin,
        cplMax: overrides?.cplMax ?? cplMax,
        from: overrides?.from ?? dateFrom,
        to: overrides?.to ?? dateTo,
      };

      if (values.q.trim()) params.set("q", values.q.trim());
      else params.delete("q");

      if (values.status && values.status !== "all") params.set("status", values.status);
      else params.delete("status");

      if (values.sort && values.sort !== "created_desc") params.set("sort", values.sort);
      else params.delete("sort");

      if (values.cplMin) params.set("cplMin", values.cplMin);
      else params.delete("cplMin");

      if (values.cplMax) params.set("cplMax", values.cplMax);
      else params.delete("cplMax");

      if (values.from) params.set("from", values.from);
      else params.delete("from");

      if (values.to) params.set("to", values.to);
      else params.delete("to");

      params.delete("page");

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [search, status, sort, cplMin, cplMax, dateFrom, dateTo, pathname, router, searchParams],
  );

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setSort("created_desc");
    setCplMin("");
    setCplMax("");
    setDateFrom("");
    setDateTo("");
    startTransition(() => {
      router.push(pathname);
    });
  }

  const hasFilters =
    searchParams.has("q") ||
    searchParams.has("status") ||
    searchParams.has("sort") ||
    searchParams.has("cplMin") ||
    searchParams.has("cplMax") ||
    searchParams.has("from") ||
    searchParams.has("to");

  return (
    <div className="border-b border-border bg-muted/80 px-4 py-2.5">
      <div className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto">
        <div className="relative min-w-[120px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search campaign or advertiser..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="h-8 w-full rounded-md border-border bg-white pl-8 text-xs"
          />
        </div>

        <Select
          value={sort}
          onValueChange={(v) => {
            if (!v) return;
            setSort(v);
            applyFilters({ sort: v });
          }}
        >
          <SelectTrigger className="h-8 w-[104px] shrink-0 rounded-md border-border bg-card text-xs">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_desc">Newest</SelectItem>
            <SelectItem value="cpl_asc">CPL ↑</SelectItem>
            <SelectItem value="cpl_desc">CPL ↓</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(v) => {
            if (!v) return;
            setStatus(v);
            applyFilters({ status: v });
          }}
        >
          <SelectTrigger className="h-8 w-[100px] shrink-0 rounded-md border-border bg-card text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
            <SelectItem value="STOP">Stopped</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex shrink-0 items-center gap-1">
          <Input
            type="number"
            min={0}
            step={0.01}
            placeholder="Min $"
            value={cplMin}
            onChange={(e) => setCplMin(e.target.value)}
            className="h-8 w-[72px] rounded-md border-border bg-card text-xs"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="number"
            min={0}
            step={0.01}
            placeholder="Max $"
            value={cplMax}
            onChange={(e) => setCplMax(e.target.value)}
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
            {isPending ? "..." : "Search"}
          </Button>
          {hasFilters && (
            <Button
              size="sm"
              variant="outline"
              onClick={clearFilters}
              disabled={isPending}
              className="h-8 gap-1 rounded-md border-border bg-card px-2.5 text-xs"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
