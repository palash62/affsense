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
import { parsePerformanceSource, type PerformanceSource } from "@/lib/publisher-performance";

const LABEL_CLASS = "text-xs font-medium text-muted-foreground";

const SOURCES: { value: PerformanceSource; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "cpa", label: "CPA Offers" },
  { value: "digital", label: "Digital Products" },
];

export function PublisherPerformanceFilters({
  defaultFrom,
  defaultTo,
}: {
  defaultFrom: string;
  defaultTo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [from, setFrom] = useState(searchParams.get("from") ?? defaultFrom);
  const [to, setTo] = useState(searchParams.get("to") ?? defaultTo);
  const [source, setSource] = useState<PerformanceSource>(parsePerformanceSource(searchParams.get("source")));

  function push(params: URLSearchParams) {
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function apply() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (source !== "all") params.set("source", source);
    push(params);
  }

  function clear() {
    setFrom(defaultFrom);
    setTo(defaultTo);
    setSource("all");
    push(new URLSearchParams({ from: defaultFrom, to: defaultTo }));
  }

  const hasFilters =
    searchParams.has("source") ||
    (searchParams.has("from") && searchParams.get("from") !== defaultFrom) ||
    (searchParams.has("to") && searchParams.get("to") !== defaultTo);

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
        <div className="min-w-[170px] space-y-1">
          <label className={LABEL_CLASS}>Source</label>
          <Select value={source} onValueChange={(v) => v && setSource(parsePerformanceSource(v))}>
            <SelectTrigger className="h-8 !w-full bg-card text-xs">
              <SelectValue>{SOURCES.find((s) => s.value === source)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex shrink-0 items-end gap-1.5 pb-0.5">
          <Button
            size="sm"
            onClick={apply}
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
