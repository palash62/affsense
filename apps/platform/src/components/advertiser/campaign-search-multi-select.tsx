"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type CampaignSearchMultiSelectProps = {
  label: string;
  hint?: string;
  options: readonly string[];
  selected: string[];
  onChange: (values: string[]) => void;
  searchPlaceholder?: string;
};

export function CampaignSearchMultiSelect({
  label,
  hint,
  options,
  selected,
  onChange,
  searchPlaceholder = "Search...",
}: CampaignSearchMultiSelectProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const available = useMemo(
    () => options.filter((option) => !selected.includes(option)),
    [options, selected],
  );

  const suggestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return available;
    return available.filter((option) => option.toLowerCase().includes(term));
  }, [search, available]);

  const showAsChips = options.length <= 8;

  function addValue(value: string) {
    if (!selected.includes(value)) {
      onChange([...selected, value]);
    }
    setSearch("");
    setOpen(false);
  }

  function removeValue(value: string) {
    onChange(selected.filter((item) => item !== value));
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      <div className="relative">
        <div
          className={cn(
            "flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5",
            open && !showAsChips && "ring-2 ring-[var(--theme-primary)]/15",
          )}
        >
          {selected.map((value) => (
            <Badge
              key={value}
              variant="outline"
              className="gap-1 border-border bg-muted pr-1 text-xs font-normal text-foreground"
            >
              {value}
              <button
                type="button"
                onClick={() => removeValue(value)}
                className="rounded p-0.5 hover:bg-slate-200"
                aria-label={`Remove ${value}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {!showAsChips && (
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder={selected.length === 0 ? searchPlaceholder : ""}
              className="min-w-[140px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
            />
          )}
          {showAsChips && selected.length === 0 && (
            <span className="px-1 text-sm text-muted-foreground">{searchPlaceholder}</span>
          )}
        </div>

        {!showAsChips && open && suggestions.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg">
            {suggestions.map((value) => (
              <button
                key={value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addValue(value)}
                className="flex w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
              >
                {value}
              </button>
            ))}
          </div>
        )}
      </div>

      {showAsChips && (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const active = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => (active ? removeValue(option) : addValue(option))}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
