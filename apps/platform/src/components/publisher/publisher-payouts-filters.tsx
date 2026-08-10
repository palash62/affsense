"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { FilterX, Search } from "lucide-react";
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
  { value: "PENDING", label: "Pending" },
  { value: "REQUESTED", label: "Requested" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "PROCESSING", label: "Processing" },
  { value: "FAILED", label: "Failed" },
] as const;

const METHOD_OPTIONS = [
  { value: "all", label: "All methods" },
  { value: "WISE", label: "Wise" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "STRIPE_CONNECT", label: "Stripe Connect" },
] as const;

export function PublisherPayoutsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [method, setMethod] = useState(searchParams.get("method") ?? "all");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("to") ?? "");

  const applyFilters = useCallback(
    (overrides?: Partial<{ status: string; method: string; from: string; to: string }>) => {
      const params = new URLSearchParams(searchParams.toString());

      const values = {
        status: overrides?.status ?? status,
        method: overrides?.method ?? method,
        from: overrides?.from ?? dateFrom,
        to: overrides?.to ?? dateTo,
      };

      params.set("tab", "payouts");

      if (values.status && values.status !== "all") params.set("status", values.status);
      else params.delete("status");

      if (values.method && values.method !== "all") params.set("method", values.method);
      else params.delete("method");

      if (values.from) params.set("from", values.from);
      else params.delete("from");

      if (values.to) params.set("to", values.to);
      else params.delete("to");

      params.delete("page");

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [status, method, dateFrom, dateTo, pathname, router, searchParams],
  );

  function clearFilters() {
    setStatus("all");
    setMethod("all");
    setDateFrom("");
    setDateTo("");
    startTransition(() => {
      router.push(`${pathname}?tab=payouts`);
    });
  }

  const hasFilters =
    searchParams.has("status") ||
    searchParams.has("method") ||
    searchParams.has("from") ||
    searchParams.has("to");

  return (
    <div className="border-b border-border bg-muted/80 px-4 py-2.5">
      <div className="flex w-full flex-wrap items-center gap-2">
        <Select value={status} onValueChange={(value) => value && setStatus(value)}>
          <SelectTrigger className="h-8 min-w-[130px] flex-1 rounded-md border-border bg-card text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={method} onValueChange={(value) => value && setMethod(value)}>
          <SelectTrigger className="h-8 min-w-[130px] flex-1 rounded-md border-border bg-card text-xs">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            {METHOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
            className="h-8 gap-1 rounded-md bg-[var(--theme-primary)] px-4 text-xs hover:opacity-90"
          >
            <Search className="h-3 w-3" />
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
