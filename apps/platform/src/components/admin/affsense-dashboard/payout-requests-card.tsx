"use client";

import { Building2, CreditCard, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "./dashboard-card";
import type { AdminPayoutRow } from "@/services/admin.service";

function methodIcon(method: string) {
  if (method === "BANK_TRANSFER") return Building2;
  if (method === "STRIPE_CONNECT") return CreditCard;
  return Wallet;
}

function methodLabel(method: string) {
  return method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "COMPLETED" && "bg-emerald-50 text-emerald-700",
        (status === "PENDING" || status === "REQUESTED") && "bg-amber-50 text-amber-700",
        status === "PROCESSING" && "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]",
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

export function PayoutRequestsCard({ payouts }: { payouts: AdminPayoutRow[] }) {
  if (payouts.length === 0) {
    return (
      <DashboardCard className="flex h-full flex-col">
        <div className="mb-4">
          <DashboardCardTitle>Payout Requests</DashboardCardTitle>
          <DashboardCardDescription>Pending and in-progress withdrawals</DashboardCardDescription>
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">No pending payout requests</p>
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="mb-4">
        <DashboardCardTitle>Payout Requests</DashboardCardTitle>
        <DashboardCardDescription>Pending and in-progress withdrawals</DashboardCardDescription>
      </div>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-2 pb-3 font-medium">Publisher</th>
              <th className="px-2 pb-3 font-medium">Amount</th>
              <th className="px-2 pb-3 font-medium">Method</th>
              <th className="px-2 pb-3 font-medium">Requested</th>
              <th className="px-2 pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((row) => {
              const Icon = methodIcon(row.method);
              return (
                <tr
                  key={row.id}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="px-2 py-3">
                    <p className="font-medium text-foreground">{row.publisherName}</p>
                    <p className="text-xs text-muted-foreground">{row.publisherEmail}</p>
                  </td>
                  <td className="px-2 py-3 font-semibold text-foreground">
                    ${row.amount.toFixed(2)}
                  </td>
                  <td className="px-2 py-3">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {methodLabel(row.method)}
                    </span>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(row.createdAt)}
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
