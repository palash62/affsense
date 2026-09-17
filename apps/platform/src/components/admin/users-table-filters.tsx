"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
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

const DEBOUNCE_MS = 300;

export function UsersTableFilters({ showDateRange = true }: { showDateRange?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("to") ?? "");

  const searchRef = useRef(search);
  const statusRef = useRef(status);
  const dateFromRef = useRef(dateFrom);
  const dateToRef = useRef(dateTo);
  const urlQRef = useRef(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSearchDebounce = useRef(false);
  const searchMounted = useRef(false);

  searchRef.current = search;
  statusRef.current = status;
  dateFromRef.current = dateFrom;
  dateToRef.current = dateTo;
  urlQRef.current = searchParams.get("q") ?? "";

  const applyFilters = useCallback(
    (overrides?: { q?: string; status?: string; from?: string; to?: string }) => {
      const params = new URLSearchParams();

      const values = {
        q: overrides?.q ?? searchRef.current,
        status: overrides?.status ?? statusRef.current,
        from: overrides?.from ?? dateFromRef.current,
        to: overrides?.to ?? dateToRef.current,
      };

      if (values.q.trim()) params.set("q", values.q.trim());
      if (values.status && values.status !== "all") params.set("status", values.status);

      if (showDateRange) {
        if (values.from) params.set("from", values.from);
        if (values.to) params.set("to", values.to);
      }

      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [pathname, router, showDateRange],
  );

  useEffect(() => {
    if (!searchMounted.current) {
      searchMounted.current = true;
      return;
    }
    if (skipNextSearchDebounce.current) {
      skipNextSearchDebounce.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchRef.current.trim() === urlQRef.current.trim()) return;
      applyFilters({ q: searchRef.current });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, applyFilters]);

  function clearFilters() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    skipNextSearchDebounce.current = true;
    setSearch("");
    setStatus("all");
    setDateFrom("");
    setDateTo("");
    startTransition(() => {
      router.push(pathname);
    });
  }

  const hasFilters =
    searchParams.has("q") ||
    searchParams.has("status") ||
    (showDateRange && (searchParams.has("from") || searchParams.has("to")));

  return (
    <div className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:p-3.5">
      <div className="flex w-full flex-col gap-2 lg:flex-row lg:flex-nowrap lg:items-center">
        <div className="relative min-w-[160px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (debounceRef.current) clearTimeout(debounceRef.current);
              applyFilters({ q: search });
            }}
            className="h-8 w-full rounded-md border-border bg-background pl-8 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status}
            onValueChange={(v) => {
              if (!v) return;
              setStatus(v);
              applyFilters({ status: v });
            }}
          >
            <SelectTrigger className="h-8 w-[118px] shrink-0 rounded-md border-border bg-background text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="SUSPENDED">Blocked</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
            </SelectContent>
          </Select>

          {showDateRange ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  const next = e.target.value;
                  setDateFrom(next);
                  applyFilters({ from: next });
                }}
                className="h-8 w-[132px] rounded-md border-border bg-background text-xs"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  const next = e.target.value;
                  setDateTo(next);
                  applyFilters({ to: next });
                }}
                className="h-8 w-[132px] rounded-md border-border bg-background text-xs"
              />
            </div>
          ) : null}

          <Button
            size="sm"
            onClick={() => {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              applyFilters();
            }}
            disabled={isPending}
            className="h-8 rounded-md bg-[var(--theme-primary)] px-4 text-xs text-white hover:opacity-90"
          >
            {isPending ? "..." : "Search"}
          </Button>

          {hasFilters ? (
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
