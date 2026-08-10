"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import type { ProfitGroupBy, ProfitPeriod } from "@/services/admin-profit.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PERIODS: { value: ProfitPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom" },
];

const GROUPS: { value: ProfitGroupBy; label: string }[] = [
  { value: "day", label: "By Day" },
  { value: "month", label: "By Month" },
  { value: "year", label: "By Year" },
];

export function AdminProfitFilters({
  period,
  fromStr,
  toStr,
  groupBy,
}: {
  period: ProfitPeriod;
  fromStr: string;
  toStr: string;
  groupBy: ProfitGroupBy;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [dateFrom, setDateFrom] = useState(fromStr);
  const [dateTo, setDateTo] = useState(toStr);

  useEffect(() => {
    setDateFrom(fromStr);
    setDateTo(toStr);
  }, [fromStr, toStr]);

  const pushParams = useCallback(
    (next: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (!value) params.delete(key);
        else params.set(key, value);
      }
      // Filter changes should always restart at page 1
      if (!("page" in next) || next.page === undefined) {
        params.delete("page");
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams],
  );

  function setPeriod(next: ProfitPeriod) {
    if (next === "custom") {
      pushParams({
        period: "custom",
        from: dateFrom,
        to: dateTo,
        group: groupBy,
      });
      return;
    }
    pushParams({
      period: next,
      from: undefined,
      to: undefined,
      group: next === "year" ? "month" : groupBy === "year" ? "day" : groupBy,
    });
  }

  function applyCustomRange() {
    pushParams({
      period: "custom",
      from: dateFrom,
      to: dateTo,
      group: groupBy,
    });
  }

  function resetFilters() {
    startTransition(() => {
      router.push(pathname);
    });
  }

  return (
    <div className="space-y-4 rounded-[18px] border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((item) => (
          <button
            key={item.value}
            type="button"
            disabled={isPending}
            onClick={() => setPeriod(item.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              period === item.value
                ? "bg-[var(--theme-primary)] text-white"
                : "bg-muted text-foreground hover:bg-slate-200",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-[11.5rem] bg-white"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-[11.5rem] bg-white"
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={applyCustomRange}
          disabled={isPending}
          className="h-9 bg-[var(--theme-primary)] hover:opacity-90"
        >
          {isPending ? "Applying..." : "Apply range"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={resetFilters} className="h-9 gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <span className="mr-1 self-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Report
        </span>
        {GROUPS.map((item) => (
          <button
            key={item.value}
            type="button"
            disabled={isPending}
            onClick={() =>
              pushParams({
                period,
                from: period === "custom" ? dateFrom : undefined,
                to: period === "custom" ? dateTo : undefined,
                group: item.value,
              })
            }
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              groupBy === item.value
                ? "bg-slate-900 text-white"
                : "bg-muted text-foreground hover:bg-slate-200",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
