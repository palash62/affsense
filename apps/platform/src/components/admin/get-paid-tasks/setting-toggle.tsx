"use client";

import { cn } from "@/lib/utils";

export function SettingToggle({
  label,
  checked,
  onCheckedChange,
  activeLabel = "Yes",
  inactiveLabel = "No",
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className="inline-flex items-center gap-2"
      >
        <span
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            checked ? "bg-[var(--theme-success)]" : "bg-muted-foreground/30",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
              checked && "translate-x-5",
            )}
          />
        </span>
        <span
          className={cn(
            "min-w-[3.25rem] text-xs font-semibold",
            checked ? "text-[var(--theme-success)]" : "text-muted-foreground",
          )}
        >
          {checked ? activeLabel : inactiveLabel}
        </span>
      </button>
    </div>
  );
}
