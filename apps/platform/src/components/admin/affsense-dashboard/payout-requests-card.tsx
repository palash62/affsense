"use client";

import { Building2, CreditCard, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "./dashboard-card";
import {
  affsensePayouts,
  type PayoutMethod,
  type PayoutStatus,
} from "./mock-data";

function methodIcon(method: PayoutMethod) {
  if (method === "Bank Transfer") return Building2;
  if (method === "Payoneer") return CreditCard;
  return Wallet;
}

function StatusPill({ status }: { status: PayoutStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "Completed" && "bg-emerald-50 text-emerald-700",
        status === "Pending" && "bg-amber-50 text-amber-700",
        status === "Processing" && "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]",
      )}
    >
      {status}
    </span>
  );
}

export function PayoutRequestsCard() {
  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="mb-4">
        <DashboardCardTitle>Payout Requests</DashboardCardTitle>
        <DashboardCardDescription>
          Pending and recent withdrawals
        </DashboardCardDescription>
      </div>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-2 pb-3 font-medium">User</th>
              <th className="px-2 pb-3 font-medium">Amount</th>
              <th className="px-2 pb-3 font-medium">Method</th>
              <th className="px-2 pb-3 font-medium">Request Date</th>
              <th className="px-2 pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {affsensePayouts.map((row) => {
              const Icon = methodIcon(row.method);
              return (
                <tr
                  key={`${row.user}-${row.date}`}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="px-2 py-3 font-medium text-foreground">{row.user}</td>
                  <td className="px-2 py-3 font-semibold text-foreground">{row.amount}</td>
                  <td className="px-2 py-3">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {row.method}
                    </span>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-xs text-muted-foreground">
                    {row.date}
                  </td>
                  <td className="px-2 py-3">
                    <StatusPill status={row.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}
