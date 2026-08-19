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
import {
  DIGITAL_PRODUCT_TYPES,
} from "./digital-product-types";

export function DigitalProductsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [category, setCategory] = useState(searchParams.get("category") ?? "all");
  const [type, setType] = useState(searchParams.get("type") ?? "all");
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/v1/admin/digital-products/categories")
      .then((r) => r.json())
      .then((json) => {
        setCategories(
          (json.data ?? [])
            .filter((c: { status: string }) => c.status === "Active")
            .map((c: { name: string }) => c.name),
        );
      })
      .catch(() => {});
  }, []);

  const applyFilters = useCallback(
    (overrides?: { q?: string; status?: string; category?: string; type?: string }) => {
      const params = new URLSearchParams();

      const values = {
        q: overrides?.q ?? search,
        status: overrides?.status ?? status,
        category: overrides?.category ?? category,
        type: overrides?.type ?? type,
      };

      if (values.q.trim()) params.set("q", values.q.trim());
      if (values.status && values.status !== "all") params.set("status", values.status);
      if (values.category && values.category !== "all") params.set("category", values.category);
      if (values.type && values.type !== "all") params.set("type", values.type);

      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [search, status, category, type, pathname, router],
  );

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setCategory("all");
    setType("all");
    startTransition(() => {
      router.push(pathname);
    });
  }

  const hasFilters =
    searchParams.has("q") ||
    searchParams.has("status") ||
    searchParams.has("category") ||
    searchParams.has("type");

  return (
    <div className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:p-3.5">
      <div className="flex w-full flex-col gap-2 lg:flex-row lg:flex-nowrap lg:items-center">
        <div className="relative min-w-[160px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, vendor, category..."
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
              <SelectTrigger className="h-8 w-[140px] shrink-0 rounded-md border-border bg-background text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Type</span>
            <Select
              value={type}
              onValueChange={(v) => {
                if (!v) return;
                setType(v);
                applyFilters({ type: v });
              }}
            >
              <SelectTrigger className="h-8 w-[150px] shrink-0 rounded-md border-border bg-background text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {DIGITAL_PRODUCT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
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
