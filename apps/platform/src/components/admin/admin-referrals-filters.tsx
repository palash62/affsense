"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminReferralsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  const applyFilters = useCallback(
    (overrides?: { q?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      const q = (overrides?.q ?? search).trim();
      if (q) params.set("q", q);
      else params.delete("q");

      startTransition(() => {
        router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
      });
    },
    [search, pathname, router, searchParams],
  );

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        applyFilters();
      }}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <label htmlFor="referral-search" className="text-xs font-medium text-muted-foreground">
          Search
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="referral-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Referrer, referred, email, or code"
            className="h-10 rounded-xl border-border pl-9"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="h-10 rounded-xl" disabled={isPending}>
          {isPending ? "Searching..." : "Search"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl border-border"
          disabled={isPending}
          onClick={() => {
            setSearch("");
            applyFilters({ q: "" });
          }}
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>
    </form>
  );
}
