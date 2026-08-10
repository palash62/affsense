"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { FilterX, Search } from "lucide-react";
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

type PublisherOption = {
  id: string;
  name: string;
  email: string;
  publisherProfile?: { website: string | null } | null;
};

const KIND_OPTIONS = [
  { value: "all", label: "All kinds" },
  { value: "PUBLISHER", label: "Publisher" },
  { value: "REFERRAL", label: "Referral" },
] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "REQUESTED", label: "Requested" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "PROCESSING", label: "Processing" },
  { value: "FAILED", label: "Failed" },
] as const;

export function AdminPayoutsFilters({ publishers }: { publishers: PublisherOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [publisherId, setPublisherId] = useState(searchParams.get("publisher") ?? "all");
  const [kind, setKind] = useState(searchParams.get("kind") ?? "all");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("to") ?? "");

  const applyFilters = useCallback(
    (overrides?: Partial<{ publisher: string; kind: string; status: string; from: string; to: string }>) => {
      const params = new URLSearchParams(searchParams.toString());

      const values = {
        publisher: overrides?.publisher ?? publisherId,
        kind: overrides?.kind ?? kind,
        status: overrides?.status ?? status,
        from: overrides?.from ?? dateFrom,
        to: overrides?.to ?? dateTo,
      };

      if (values.publisher && values.publisher !== "all") params.set("publisher", values.publisher);
      else params.delete("publisher");

      if (values.kind && values.kind !== "all") params.set("kind", values.kind);
      else params.delete("kind");

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
    [publisherId, kind, status, dateFrom, dateTo, pathname, router, searchParams],
  );

  function clearFilters() {
    setPublisherId("all");
    setKind("all");
    setStatus("all");
    setDateFrom("");
    setDateTo("");
    startTransition(() => {
      router.push(pathname);
    });
  }

  const hasFilters =
    searchParams.has("publisher") ||
    searchParams.has("kind") ||
    searchParams.has("status") ||
    searchParams.has("from") ||
    searchParams.has("to");

  return (
    <div className="border-b border-border bg-muted/60 px-6 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              User
            </label>
            <Select value={publisherId} onValueChange={(value) => value && setPublisherId(value)}>
              <SelectTrigger className="h-10 w-full bg-white">
                <SelectValue placeholder="All publishers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All publishers</SelectItem>
                {publishers.map((publisher) => (
                  <SelectItem key={publisher.id} value={publisher.id}>
                    {formatPublisherOptionLabel(publisher)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Kind
            </label>
            <Select value={kind} onValueChange={(value) => value && setKind(value)}>
              <SelectTrigger className="h-10 w-full bg-white">
                <SelectValue placeholder="All kinds" />
              </SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
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
