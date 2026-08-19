"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
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

export function GetPaidTasksFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [category, setCategory] = useState(searchParams.get("category") ?? "all");
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/v1/admin/get-paid-tasks/categories")
      .then((r) => r.json())
      .then((json) => {
        setCategories((json.data ?? []).map((c: { name: string }) => c.name));
      })
      .catch(() => {});
  }, []);

  const applyFilters = useCallback(
    (overrides?: { q?: string; status?: string; category?: string }) => {
      const params = new URLSearchParams();
      const values = {
        q: overrides?.q ?? search,
        status: overrides?.status ?? status,
        category: overrides?.category ?? category,
      };
      if (values.q.trim()) params.set("q", values.q.trim());
      if (values.status && values.status !== "all") params.set("status", values.status);
      if (values.category && values.category !== "all") params.set("category", values.category);
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [search, status, category, pathname, router],
  );

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setCategory("all");
    startTransition(() => router.push(pathname));
  }

  const hasFilters =
    searchParams.has("q") || searchParams.has("status") || searchParams.has("category");

  return (
    <div className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:p-3.5">
      <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-[160px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search title, category, action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="h-8 w-full rounded-md border-border bg-background pl-8 text-xs"
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Status</span>
            <Select
              value={status}
              onValueChange={(v) => {
                if (!v) return;
                setStatus(v);
                applyFilters({ status: v });
              }}
            >
              <SelectTrigger className="h-8 w-[118px] shrink-0 rounded-md border-border bg-background text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Category</span>
            <Select
              value={category}
              onValueChange={(v) => {
                if (!v) return;
                setCategory(v);
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
          </div>

          <Button
            size="sm"
            onClick={() => applyFilters()}
            disabled={isPending}
            className="h-8 rounded-md bg-[var(--theme-primary)] px-4 text-xs hover:opacity-90"
          >
            {isPending ? "..." : "Search"}
          </Button>

          {hasFilters ? (
            <Button
              size="sm"
              variant="outline"
              onClick={clearFilters}
              disabled={isPending}
              className="h-8 gap-1 rounded-md border-border bg-card px-2.5 text-xs"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
