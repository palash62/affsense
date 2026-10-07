"use client";

import { useState, useTransition } from "react";
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
import { formatPayoutMethod } from "@/lib/payout";
import { PAYOUT_REPORT_STATUSES } from "@/lib/publisher-payout-report";

const LABEL_CLASS = "text-xs font-medium text-muted-foreground";
const TRIGGER_CLASS = "h-8 !w-full bg-card text-xs";
const FILTER_KEYS = ["from", "to", "status", "method"] as const;

export function PublisherPayoutReportFilters({ methods }: { methods: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [method, setMethod] = useState(searchParams.get("method") ?? "all");

  function push(values: Record<(typeof FILTER_KEYS)[number], string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) {
      if (values[key] && values[key] !== "all") params.set(key, values[key]);
      else params.delete(key);
    }
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function clear() {
    setFrom("");
    setTo("");
    setStatus("all");
    setMethod("all");
    push({ from: "", to: "", status: "all", method: "all" });
  }

  const hasFilters = FILTER_KEYS.some((key) => searchParams.has(key));

  return (
    <div className="border-b border-border bg-muted/80 px-4 py-2.5">
      <div className="flex w-full flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className={LABEL_CLASS}>From</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-8 w-[140px] rounded-md border-border bg-card text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className={LABEL_CLASS}>To</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-8 w-[140px] rounded-md border-border bg-card text-xs"
          />
        </div>
        <div className="min-w-[150px] space-y-1">
          <label className={LABEL_CLASS}>Status</label>
          <Select value={status} onValueChange={(v) => v && setStatus(v)}>
            <SelectTrigger className={TRIGGER_CLASS}>
              <SelectValue>{status === "all" ? "All statuses" : status}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {PAYOUT_REPORT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[160px] space-y-1">
          <label className={LABEL_CLASS}>Method</label>
          <Select value={method} onValueChange={(v) => v && setMethod(v)}>
            <SelectTrigger className={TRIGGER_CLASS}>
              <SelectValue>{method === "all" ? "All methods" : formatPayoutMethod(method)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              {methods.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatPayoutMethod(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex shrink-0 items-end gap-1.5 pb-0.5">
          <Button
            size="sm"
            onClick={() => push({ from, to, status, method })}
            disabled={isPending}
            className="h-8 rounded-md bg-[var(--theme-primary)] px-4 text-xs hover:opacity-90"
          >
            {isPending ? "..." : "Apply"}
          </Button>
          {hasFilters ? (
            <Button
              size="sm"
              variant="outline"
              onClick={clear}
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
