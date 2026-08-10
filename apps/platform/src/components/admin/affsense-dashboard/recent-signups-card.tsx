"use client";

import { cn } from "@/lib/utils";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "./dashboard-card";
import { affsenseSignups } from "./mock-data";

export function RecentSignupsCard() {
  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="mb-4">
        <DashboardCardTitle>Recent Signups</DashboardCardTitle>
        <DashboardCardDescription>Newest platform members</DashboardCardDescription>
      </div>
      <ul className="space-y-3">
        {affsenseSignups.map((user) => (
          <li key={user.email} className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                user.avatarTone,
              )}
            >
              {user.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{user.at}</span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
