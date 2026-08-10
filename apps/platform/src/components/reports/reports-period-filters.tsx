"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReportsPeriodFilters({
  preserveKeys = [],
}: {
  preserveKeys?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [dateFrom, setDateFrom] = useState(searchParams.get("from") ?? defaultCampaignDateFrom());
  const [dateTo, setDateTo] = useState(searchParams.get("to") ?? defaultCampaignDateTo());

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    for (const key of preserveKeys) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }, [dateFrom, dateTo, pathname, preserveKeys, router, searchParams]);

  function resetFilters() {
    setDateFrom(defaultCampaignDateFrom());
    setDateTo(defaultCampaignDateTo());
    const params = new URLSearchParams();
    for (const key of preserveKeys) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    startTransition(() => {
      router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-border bg-muted/50 px-4 py-4 sm:px-6">
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
        onClick={applyFilters}
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
  );
}
