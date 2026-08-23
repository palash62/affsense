"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PublisherMarketplaceFilters({ categories }: { categories: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const search = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "all";

  const applyFilters = useCallback(
    (overrides?: { q?: string; category?: string }) => {
      const params = new URLSearchParams();
      const values = {
        q: overrides?.q ?? search,
        category: overrides?.category ?? category,
      };
      if (values.q.trim()) params.set("q", values.q.trim());
      if (values.category && values.category !== "all") params.set("category", values.category);
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [search, category, pathname, router],
  );

  function clearFilters() {
    startTransition(() => router.push(pathname));
  }

  const hasFilters = searchParams.has("q") || searchParams.has("category");

  return (
    <div className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:p-3.5">
      <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-[160px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            defaultValue={search}
            key={`q-${search}`}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                applyFilters({ q: (e.target as HTMLInputElement).value });
              }
            }}
            className="h-8 w-full rounded-md border-border bg-background pl-8 text-xs"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={category}
            onValueChange={(v) => {
              if (!v) return;
              applyFilters({ category: v });
            }}
          >
            <SelectTrigger className="h-8 w-[150px] shrink-0 rounded-md border-border bg-background text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground"
              onClick={clearFilters}
              disabled={isPending}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
