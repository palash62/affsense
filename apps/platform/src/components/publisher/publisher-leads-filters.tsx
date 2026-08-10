"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SMART_LINK_PLATFORMS } from "@/lib/smart-link";

export function PublisherLeadsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [source, setSource] = useState(searchParams.get("source") ?? "all");

  const applyFilters = useCallback(
    (overrides?: Partial<{ source: string }>) => {
      const params = new URLSearchParams(searchParams.toString());
      const sourceValue = overrides?.source ?? source;

      if (sourceValue && sourceValue !== "all") params.set("source", sourceValue);
      else params.delete("source");

      params.delete("page");

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [source, pathname, router, searchParams],
  );

  function clearFilters() {
    setSource("all");
    startTransition(() => {
      router.push(pathname);
    });
  }

  const hasFilters =
    searchParams.has("source") ||
    searchParams.has("sort") ||
    (searchParams.has("page") && searchParams.get("page") !== "1");

  return (
    <div className="border-b border-border bg-muted/80 px-4 py-2.5">
      <div className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto">
        <Select
          value={source}
          onValueChange={(v) => {
            const next = v ?? "all";
            setSource(next);
            applyFilters({ source: next });
          }}
        >
          <SelectTrigger className="h-8 w-[140px] rounded-md border-border bg-card text-xs">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {SMART_LINK_PLATFORMS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
  );
}
