"use client";

import { cn } from "@/lib/utils";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "./dashboard-card";
import type { AdminDepositRow } from "@/services/admin.service";

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "COMPLETED"
          ? "bg-emerald-50 text-emerald-700"
          : status === "PENDING"
            ? "bg-amber-50 text-amber-700"
            : "bg-rose-50 text-rose-700",
      )}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function RecentTransactionsCard({ deposits }: { deposits: AdminDepositRow[] }) {
  if (deposits.length === 0) {
    return (
      <DashboardCard className="flex h-full flex-col">
        <div className="mb-4">
          <DashboardCardTitle>Recent Deposits</DashboardCardTitle>
          <DashboardCardDescription>Latest advertiser wallet top-ups</DashboardCardDescription>
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">No deposits yet</p>
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="mb-4">
        <DashboardCardTitle>Recent Deposits</DashboardCardTitle>
        <DashboardCardDescription>Latest advertiser wallet top-ups</DashboardCardDescription>
      </div>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-2 pb-3 font-medium">User</th>
              <th className="px-2 pb-3 font-medium">Amount</th>
              <th className="px-2 pb-3 font-medium">Method</th>
              <th className="px-2 pb-3 font-medium">Status</th>
              <th className="px-2 pb-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {deposits.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-50 last:border-0"
              >
                <td className="px-2 py-3">
                  <p className="font-medium text-foreground">{row.userName}</p>
                  <p className="text-xs text-muted-foreground">{row.userEmail}</p>
                </td>
                <td className="px-2 py-3 font-semibold text-foreground">
                  ${row.amount.toFixed(2)}
                </td>
                <td className="px-2 py-3 text-muted-foreground">
                  {row.method.replace(/_/g, " ")}
                </td>
                <td className="px-2 py-3">
                  <StatusPill status={row.status} />
                </td>
                <td className="px-2 py-3 whitespace-nowrap text-xs text-muted-foreground">
                  {formatDate(row.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}
