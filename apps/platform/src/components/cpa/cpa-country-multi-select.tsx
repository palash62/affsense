"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CPA_COUNTRY_OPTIONS,
  flagForCountry,
  parseOfferCountries,
} from "@/components/cpa/cpa-offer-geo-flags";

export function countriesToStorage(codes: string[]): string {
  return codes.map((c) => c.toUpperCase()).join(", ");
}

export function countriesFromStorage(country: string): string[] {
  return parseOfferCountries(country).filter((code) => code !== "ALL");
}

type CpaCountryMultiSelectProps = {
  value: string[];
  onChange: (codes: string[]) => void;
  className?: string;
};

export function CpaCountryMultiSelect({ value, onChange, className }: CpaCountryMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CPA_COUNTRY_OPTIONS;
    return CPA_COUNTRY_OPTIONS.filter(
      (opt) => opt.code.toLowerCase().includes(q) || opt.name.toLowerCase().includes(q),
    );
  }, [query]);

  function toggle(code: string) {
    if (value.includes(code)) {
      onChange(value.filter((c) => c !== code));
    } else {
      onChange([...value, code]);
    }
  }

  function remove(code: string) {
    onChange(value.filter((c) => c !== code));
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-10 w-full justify-between gap-2 bg-card px-3 py-2 font-normal"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="truncate text-left text-sm text-muted-foreground">
            {value.length === 0 ? "Select countries (global if empty)" : `${value.length} selected`}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>

        {open ? (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            <div className="border-b border-border p-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country…"
                className="h-8"
                autoFocus
              />
            </div>
            <ul className="max-h-56 overflow-y-auto p-1">
              {filtered.map((opt) => {
                const selected = value.includes(opt.code);
                return (
                  <li key={opt.code}>
                    <button
                      type="button"
                      onClick={() => toggle(opt.code)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                        selected && "bg-sky-50",
                      )}
                    >
                      <span aria-hidden>{opt.flag}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {opt.name}{" "}
                        <span className="text-xs text-muted-foreground">({opt.code})</span>
                      </span>
                      {selected ? <Check className="h-3.5 w-3.5 text-sky-700" /> : null}
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 ? (
                <li className="px-2 py-3 text-center text-xs text-muted-foreground">No matches</li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-xs font-medium text-foreground"
            >
              <span aria-hidden>{flagForCountry(code)}</span>
              {code}
              <button
                type="button"
                onClick={() => remove(code)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${code}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No countries selected — offer is available globally.</p>
      )}
    </div>
  );
}
