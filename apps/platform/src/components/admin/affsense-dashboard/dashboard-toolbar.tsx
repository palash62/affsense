"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import { AFFSENSE_DATE_RANGE_LABEL } from "./mock-data";

export function DashboardToolbar() {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
      >
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <span>{AFFSENSE_DATE_RANGE_LABEL}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
