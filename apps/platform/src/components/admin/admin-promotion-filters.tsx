"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminPromotionFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");

  const applyFilters = useCallback(
    (overrides?: { q?: string; from?: string; to?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      const q = (overrides?.q ?? search).trim();
      const fromValue = (overrides?.from ?? from).trim();
      const toValue = (overrides?.to ?? to).trim();

      if (q) params.set("q", q);
      else params.delete("q");
      if (fromValue) params.set("from", fromValue);
      else params.delete("from");
      if (toValue) params.set("to", toValue);
      else params.delete("to");

      startTransition(() => {
        router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
      });
    },
    [from, pathname, router, search, searchParams, to],
  );

  return (
    <form
      className="flex flex-col gap-3 lg:flex-row lg:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        applyFilters();
      }}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <label htmlFor="promotion-search" className="text-xs font-medium text-slate-600">
          Search
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="promotion-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Advertiser, email, or UTM"
            className="h-10 rounded-xl border-slate-200 pl-9"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="promotion-from" className="text-xs font-medium text-slate-600">
          From
        </label>
        <Input
          id="promotion-from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-10 rounded-xl border-slate-200"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="promotion-to" className="text-xs font-medium text-slate-600">
          To
        </label>
        <Input
          id="promotion-to"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-10 rounded-xl border-slate-200"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="h-10 rounded-xl" disabled={isPending}>
          {isPending ? "Filtering…" : "Apply"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl border-slate-200"
          disabled={isPending}
          onClick={() => {
            setSearch("");
            setFrom("");
            setTo("");
            applyFilters({ q: "", from: "", to: "" });
          }}
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>
    </form>
  );
}
