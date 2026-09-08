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

type PublisherOption = { id: string; name: string; email: string };

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export function AdminInvoicesFilters({ publishers }: { publishers: PublisherOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [publisherId, setPublisherId] = useState(searchParams.get("publisher") ?? "all");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("to") ?? "");

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (publisherId && publisherId !== "all") params.set("publisher", publisherId);
    else params.delete("publisher");

    if (status && status !== "all") params.set("status", status);
    else params.delete("status");

    if (dateFrom) params.set("from", dateFrom);
    else params.delete("from");

    if (dateTo) params.set("to", dateTo);
    else params.delete("to");

    params.delete("page");

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }, [publisherId, status, dateFrom, dateTo, pathname, router, searchParams]);

  function clearFilters() {
    setPublisherId("all");
    setStatus("all");
    setDateFrom("");
    setDateTo("");
    startTransition(() => {
      router.push(pathname);
    });
  }

  const hasFilters =
    searchParams.has("publisher") ||
    searchParams.has("status") ||
    searchParams.has("from") ||
    searchParams.has("to");

  return (
    <div className="border-b border-border bg-muted/60 px-6 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Affiliate
            </label>
            <Select value={publisherId} onValueChange={(value) => value && setPublisherId(value)}>
              <SelectTrigger className="h-10 w-full bg-white">
                <SelectValue placeholder="All affiliates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All affiliates</SelectItem>
                {publishers.map((publisher) => (
                  <SelectItem key={publisher.id} value={publisher.id}>
                    {publisher.name} ({publisher.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </label>
            <Select value={status} onValueChange={(value) => value && setStatus(value)}>
              <SelectTrigger className="h-10 w-full bg-white">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Issued from
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
              Issued to
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
            onClick={applyFilters}
            disabled={isPending}
            className="h-10 gap-1.5 bg-[var(--theme-primary)] hover:opacity-90"
          >
            <Search className="h-4 w-4" />
            Apply
          </Button>
          {hasFilters && (
            <Button
              type="button"
              variant="outline"
              onClick={clearFilters}
              disabled={isPending}
              className="h-10 gap-1.5"
            >
              <FilterX className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
