"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { FilterX, Search } from "lucide-react";
import { formatAdvertiserOptionLabel } from "@/lib/deposit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AdvertiserOption = {
  id: string;
  name: string;
  email: string;
  advertiserProfile?: { company: string } | null;
};

export function AdminDepositsFilters({ advertisers }: { advertisers: AdvertiserOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [advertiserId, setAdvertiserId] = useState(searchParams.get("advertiser") ?? "all");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("to") ?? "");

  const applyFilters = useCallback(
    (overrides?: Partial<{ advertiser: string; from: string; to: string }>) => {
      const params = new URLSearchParams(searchParams.toString());

      const values = {
        advertiser: overrides?.advertiser ?? advertiserId,
        from: overrides?.from ?? dateFrom,
        to: overrides?.to ?? dateTo,
      };

      if (values.advertiser && values.advertiser !== "all") params.set("advertiser", values.advertiser);
      else params.delete("advertiser");

      if (values.from) params.set("from", values.from);
      else params.delete("from");

      if (values.to) params.set("to", values.to);
      else params.delete("to");

      params.delete("page");

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [advertiserId, dateFrom, dateTo, pathname, router, searchParams],
  );

  function clearFilters() {
    setAdvertiserId("all");
    setDateFrom("");
    setDateTo("");
    startTransition(() => {
      router.push(pathname);
    });
  }

  const hasFilters =
    searchParams.has("advertiser") || searchParams.has("from") || searchParams.has("to");

  return (
    <div className="border-b border-border bg-muted/60 px-6 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Advertiser
            </label>
            <Select value={advertiserId} onValueChange={(value) => value && setAdvertiserId(value)}>
              <SelectTrigger className="h-10 w-full bg-white">
                <SelectValue placeholder="All advertisers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All advertisers</SelectItem>
                {advertisers.map((advertiser) => (
                  <SelectItem key={advertiser.id} value={advertiser.id}>
                    {formatAdvertiserOptionLabel(advertiser)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              From date
            </label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-10 bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              To date
            </label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-10 bg-white"
            />
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            onClick={() => applyFilters()}
            disabled={isPending}
            className="h-10 gap-1.5 bg-[var(--theme-primary)] hover:opacity-90"
          >
            <Search className="h-4 w-4" />
            Apply
          </Button>
          {hasFilters && (
            <Button type="button" variant="outline" onClick={clearFilters} disabled={isPending} className="h-10 gap-1.5">
              <FilterX className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
