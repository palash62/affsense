"use client";

import { CalendarDays } from "lucide-react";

export function DashboardToolbar() {
  return (
    <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-muted-foreground shadow-sm">
      <CalendarDays className="h-4 w-4" />
      Last 30 days
    </span>
  );
}
