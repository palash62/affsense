"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlanAffiliate } from "./types";

type AffiliateSearchMultiSelectProps = {
  selected: PlanAffiliate[];
  onChange: (values: PlanAffiliate[]) => void;
  /** Publisher id → name of the other plan they already belong to. */
  takenBy?: Map<string, string>;
  placeholder?: string;
};

type SearchRow = { id: string; name: string; email: string };

export function AffiliateSearchMultiSelect({
  selected,
  onChange,
  takenBy,
  placeholder = "Search affiliates by name or email...",
}: AffiliateSearchMultiSelectProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/v1/admin/publishers/search?q=${encodeURIComponent(search.trim())}`, {
        signal: ac.signal,
      })
        .then((res) => res.json().catch(() => ({})))
        .then((json) => {
          if (!ac.signal.aborted) setResults(Array.isArray(json.data) ? json.data : []);
        })
        .catch(() => {
          if (!ac.signal.aborted) setResults([]);
        })
        .finally(() => {
          if (!ac.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [search, open]);

  const selectedIds = new Set(selected.map((s) => s.publisherId));
  const suggestions = results.filter((row) => !selectedIds.has(row.id));

  function add(row: SearchRow) {
    if (takenBy?.has(row.id) || selectedIds.has(row.id)) return;
    onChange([...selected, { publisherId: row.id, name: row.name, email: row.email }]);
    setSearch("");
  }

  function remove(publisherId: string) {
    onChange(selected.filter((s) => s.publisherId !== publisherId));
  }

  return (
    <div className="relative">
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5",
          open && "ring-2 ring-[var(--theme-primary)]/15",
        )}
      >
        {selected.map((affiliate) => (
          <Badge
            key={affiliate.publisherId}
            variant="outline"
            className="gap-1 border-border bg-muted pr-1 text-xs font-normal text-foreground"
            title={affiliate.email}
          >
            {affiliate.name || affiliate.email}
            <button
              type="button"
              onClick={() => remove(affiliate.publisherId)}
              className="rounded p-0.5 hover:bg-slate-200"
              aria-label={`Remove ${affiliate.name || affiliate.email}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={selected.length === 0 ? placeholder : ""}
          className="min-w-[160px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg">
          {loading && suggestions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Searching...</p>
          ) : suggestions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No affiliates found</p>
          ) : (
            suggestions.map((row) => {
              const otherPlan = takenBy?.get(row.id);
              return (
                <button
                  key={row.id}
                  type="button"
                  disabled={Boolean(otherPlan)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(row)}
                  className={cn(
                    "flex w-full flex-col px-3 py-2 text-left text-sm",
                    otherPlan ? "cursor-not-allowed opacity-50" : "hover:bg-muted",
                  )}
                >
                  <span className="font-medium text-foreground">{row.name || row.email}</span>
                  <span className="text-xs text-muted-foreground">
                    {row.email}
                    {otherPlan ? ` · already in "${otherPlan}"` : ""}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
