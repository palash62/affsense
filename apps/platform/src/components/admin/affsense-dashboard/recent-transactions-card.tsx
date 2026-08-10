"use client";

import { cn } from "@/lib/utils";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "./dashboard-card";
import { affsenseTransactions, type TxStatus } from "./mock-data";

function StatusPill({ status }: { status: TxStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "Completed"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700",
      )}
    >
      {status}
    </span>
  );
}

export function RecentTransactionsCard() {
  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="mb-4">
        <DashboardCardTitle>Recent Transactions</DashboardCardTitle>
        <DashboardCardDescription>Latest orders and leads</DashboardCardDescription>
      </div>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-2 pb-3 font-medium">Order ID</th>
              <th className="px-2 pb-3 font-medium">User</th>
              <th className="px-2 pb-3 font-medium">Product/Offer</th>
              <th className="px-2 pb-3 font-medium">Type</th>
              <th className="px-2 pb-3 font-medium">Amount</th>
              <th className="px-2 pb-3 font-medium">Status</th>
              <th className="px-2 pb-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {affsenseTransactions.map((row) => (
              <tr
                key={row.orderId}
                className="border-b border-slate-50 last:border-0"
              >
                <td className="px-2 py-3 font-medium text-foreground">{row.orderId}</td>
                <td className="px-2 py-3 text-foreground">{row.user}</td>
                <td className="px-2 py-3 text-muted-foreground">{row.product}</td>
                <td className="px-2 py-3 text-muted-foreground">{row.type}</td>
                <td className="px-2 py-3 font-semibold text-foreground">{row.amount}</td>
                <td className="px-2 py-3">
                  <StatusPill status={row.status} />
                </td>
                <td className="px-2 py-3 whitespace-nowrap text-xs text-muted-foreground">
                  {row.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}
