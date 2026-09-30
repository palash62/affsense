"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectedAffiliate = { id: string; name: string; email: string };

type AffiliateSearchSelectProps = {
  value: SelectedAffiliate | null;
  onChange: (value: SelectedAffiliate | null) => void;
  placeholder?: string;
};

export function AffiliateSearchSelect({
  value,
  onChange,
  placeholder = "Search affiliates by name, email, or ID...",
}: AffiliateSearchSelectProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SelectedAffiliate[]>([]);
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

  if (value) {
    return (
      <div className="flex min-h-10 items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{value.name || value.email}</p>
          <p className="truncate text-xs text-muted-foreground">
            {value.email} · <span className="font-mono">{value.id}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Clear selected affiliate"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={cn(
          "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground",
          open && "ring-2 ring-[var(--theme-primary)]/15",
        )}
      />

      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg">
          {loading && results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Searching...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No affiliates found</p>
          ) : (
            results.map((row) => (
              <button
                key={row.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(row);
                  setSearch("");
                  setOpen(false);
                }}
                className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium text-foreground">{row.name || row.email}</span>
                <span className="text-xs text-muted-foreground">{row.email}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
