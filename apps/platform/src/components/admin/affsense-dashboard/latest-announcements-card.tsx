"use client";

import { Bell, Megaphone, Sparkles, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "./dashboard-card";
import { affsenseAnnouncements, type Announcement } from "./mock-data";

const toneStyles: Record<Announcement["tone"], { chip: string; icon: string }> = {
  violet: { chip: "bg-violet-50", icon: "text-violet-600" },
  emerald: { chip: "bg-emerald-50", icon: "text-emerald-600" },
  blue: { chip: "bg-[var(--theme-primary-soft)]", icon: "text-[var(--theme-primary)]" },
  amber: { chip: "bg-amber-50", icon: "text-amber-600" },
};

const toneIcons = {
  violet: Sparkles,
  emerald: Bell,
  blue: Megaphone,
  amber: Wrench,
} as const;

export function LatestAnnouncementsCard() {
  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="mb-4">
        <DashboardCardTitle>Latest Announcements</DashboardCardTitle>
        <DashboardCardDescription>Platform updates</DashboardCardDescription>
      </div>
      <ul className="space-y-3">
        {affsenseAnnouncements.map((item) => {
          const Icon = toneIcons[item.tone];
          const styles = toneStyles[item.tone];
          return (
            <li key={item.title} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  styles.chip,
                )}
              >
                <Icon className={cn("h-4 w-4", styles.icon)} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.date}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </DashboardCard>
  );
}
