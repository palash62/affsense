"use client";

import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "./dashboard-card";
import type { AdminSignupRow } from "@/services/admin.service";

const AVATAR_TONES = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-800",
];

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function RecentSignupsCard({ signups }: { signups: AdminSignupRow[] }) {
  if (signups.length === 0) {
    return (
      <DashboardCard className="flex h-full flex-col">
        <div className="mb-4">
          <DashboardCardTitle>Recent Signups</DashboardCardTitle>
          <DashboardCardDescription>Newest platform members</DashboardCardDescription>
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">No signups yet</p>
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="mb-4">
        <DashboardCardTitle>Recent Signups</DashboardCardTitle>
        <DashboardCardDescription>Newest platform members</DashboardCardDescription>
      </div>
      <ul className="space-y-3">
        {signups.map((user, i) => (
          <li key={user.id} className="flex items-center gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${AVATAR_TONES[i % AVATAR_TONES.length]}`}
            >
              {initials(user.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDate(user.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
