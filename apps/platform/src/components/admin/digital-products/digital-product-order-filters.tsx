"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LABEL_CLASS = "text-xs font-medium text-muted-foreground";
const SELECT_TRIGGER_CLASS =
  "h-8 !w-full min-w-0 bg-card text-xs *:data-[slot=select-value]:line-clamp-none";

type PublisherOption = { id: string; name: string; email: string };

const EVENT_TYPES = [
  { value: "all", label: "All types" },
  { value: "purchase", label: "Purchase" },
  { value: "upsell", label: "Upsell" },
  { value: "downsell", label: "Downsell" },
  { value: "refund", label: "Refund" },
] as const;

export function DigitalProductOrderFilters({
  publishers,
  defaultFrom,
  defaultTo,
}: {
  publishers: PublisherOption[];
  defaultFrom: string;
  defaultTo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const publisherId = searchParams.get("publisherId") ?? "all";
  const eventType = searchParams.get("eventType") ?? "all";
  const dateFrom = searchParams.get("from") ?? defaultFrom;
  const dateTo = searchParams.get("to") ?? defaultTo;

  const applyFilters = useCallback(
    (overrides?: Partial<{ publisherId: string; eventType: string; from: string; to: string }>) => {
      const params = new URLSearchParams(searchParams.toString());

      const values = {
        publisherId: overrides?.publisherId ?? publisherId,
        eventType: overrides?.eventType ?? eventType,
        from: overrides?.from ?? dateFrom,
        to: overrides?.to ?? dateTo,
      };

      if (values.publisherId && values.publisherId !== "all") {
        params.set("publisherId", values.publisherId);
      } else {
        params.delete("publisherId");
      }
      if (values.eventType && values.eventType !== "all") {
        params.set("eventType", values.eventType);
      } else {
        params.delete("eventType");
      }
      if (values.from) params.set("from", values.from);
      else params.delete("from");
      if (values.to) params.set("to", values.to);
      else params.delete("to");
      params.delete("page");

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [publisherId, eventType, dateFrom, dateTo, pathname, router, searchParams],
  );

  function clearFilters() {
    startTransition(() => {
      router.push(`${pathname}?from=${defaultFrom}&to=${defaultTo}`);
    });
  }

  const hasFilters =
    searchParams.has("publisherId") ||
    searchParams.has("eventType") ||
    (searchParams.has("from") && searchParams.get("from") !== defaultFrom) ||
    (searchParams.has("to") && searchParams.get("to") !== defaultTo);

  return (
    <div className="border-b border-border bg-muted/80 px-4 py-2.5">
      <div className="flex w-full flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1 space-y-1">
          <label className={LABEL_CLASS}>Affiliate</label>
          <Select
            value={publisherId}
            onValueChange={(v) => {
              if (!v) return;
              applyFilters({ publisherId: v });
            }}
          >
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="All Affiliates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Affiliates</SelectItem>
              {publishers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[160px] space-y-1">
          <label className={LABEL_CLASS}>Order Type</label>
          <Select
            value={eventType}
            onValueChange={(v) => {
              if (!v) return;
              applyFilters({ eventType: v });
            }}
          >
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex shrink-0 items-end gap-2">
          <div className="space-y-1">
            <label className={LABEL_CLASS}>From</label>
            <Input
              type="date"
              defaultValue={dateFrom}
              key={`from-${dateFrom}`}
              onChange={(e) => applyFilters({ from: e.target.value })}
              className="h-8 w-[132px] rounded-md border-border bg-card text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className={LABEL_CLASS}>To</label>
            <Input
              type="date"
              defaultValue={dateTo}
              key={`to-${dateTo}`}
              onChange={(e) => applyFilters({ to: e.target.value })}
              className="h-8 w-[132px] rounded-md border-border bg-card text-xs"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-end gap-1.5 pb-0.5">
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
