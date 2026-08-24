"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

const ORDER_TYPES = [
  { value: "all", label: "All types" },
  { value: "front", label: "Front End" },
  { value: "upsell", label: "Upsell" },
  { value: "downsell", label: "Downsell" },
  { value: "refund", label: "Refund" },
] as const;

const STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
] as const;

type FilterKey = "product" | "orderType" | "source" | "subId" | "status" | "from" | "to" | "q";

export function PublisherCommissionFilters({
  products,
  sources,
  subIds,
  defaultFrom,
  defaultTo,
}: {
  products: string[];
  sources: string[];
  subIds: string[];
  defaultFrom: string;
  defaultTo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const product = searchParams.get("product") ?? "all";
  const orderType = searchParams.get("orderType") ?? "all";
  const source = searchParams.get("source") ?? "all";
  const subId = searchParams.get("subId") ?? "all";
  const status = searchParams.get("status") ?? "all";
  const dateFrom = searchParams.get("from") ?? defaultFrom;
  const dateTo = searchParams.get("to") ?? defaultTo;
  const q = searchParams.get("q") ?? "";

  const applyFilters = useCallback(
    (overrides?: Partial<Record<FilterKey, string>>) => {
      const params = new URLSearchParams(searchParams.toString());
      const values: Record<FilterKey, string> = {
        product: overrides?.product ?? product,
        orderType: overrides?.orderType ?? orderType,
        source: overrides?.source ?? source,
        subId: overrides?.subId ?? subId,
        status: overrides?.status ?? status,
        from: overrides?.from ?? dateFrom,
        to: overrides?.to ?? dateTo,
        q: overrides?.q ?? q,
      };

      for (const key of ["product", "orderType", "source", "subId", "status"] as const) {
        if (values[key] && values[key] !== "all") params.set(key, values[key]);
        else params.delete(key);
      }
      if (values.from) params.set("from", values.from);
      else params.delete("from");
      if (values.to) params.set("to", values.to);
      else params.delete("to");
      if (values.q.trim()) params.set("q", values.q.trim());
      else params.delete("q");
      params.delete("page");

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [product, orderType, source, subId, status, dateFrom, dateTo, q, pathname, router, searchParams],
  );

  function clearFilters() {
    startTransition(() => {
      router.push(`${pathname}?from=${defaultFrom}&to=${defaultTo}`);
    });
  }

  const hasFilters =
    searchParams.has("product") ||
    searchParams.has("orderType") ||
    searchParams.has("source") ||
    searchParams.has("subId") ||
    searchParams.has("status") ||
    searchParams.has("q") ||
    (searchParams.has("from") && searchParams.get("from") !== defaultFrom) ||
    (searchParams.has("to") && searchParams.get("to") !== defaultTo);

  return (
    <div className="border-b border-border bg-muted/80 px-4 py-2.5">
      <div className="flex w-full flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1 space-y-1">
          <label className={LABEL_CLASS}>Product</label>
          <Select value={product} onValueChange={(v) => v && applyFilters({ product: v })}>
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {products.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[140px] space-y-1">
          <label className={LABEL_CLASS}>Type</label>
          <Select value={orderType} onValueChange={(v) => v && applyFilters({ orderType: v })}>
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              {ORDER_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[140px] space-y-1">
          <label className={LABEL_CLASS}>Source</label>
          <Select value={source} onValueChange={(v) => v && applyFilters({ source: v })}>
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {sources.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[140px] space-y-1">
          <label className={LABEL_CLASS}>Sub ID</label>
          <Select value={subId} onValueChange={(v) => v && applyFilters({ subId: v })}>
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="All sub IDs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sub IDs</SelectItem>
              {subIds.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[140px] space-y-1">
          <label className={LABEL_CLASS}>Status</label>
          <Select value={status} onValueChange={(v) => v && applyFilters({ status: v })}>
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((t) => (
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

        <div className="min-w-[180px] flex-1 space-y-1">
          <label className={LABEL_CLASS}>Search</label>
          <Input
            defaultValue={q}
            key={`q-${q}`}
            placeholder="Order ID, product, funnel..."
            className="h-8 rounded-md border-border bg-card text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                applyFilters({ q: (e.target as HTMLInputElement).value });
              }
            }}
          />
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
          {hasFilters ? (
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
