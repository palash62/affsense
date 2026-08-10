"use client";

import { useState } from "react";
import { formatUserDateTime } from "@/lib/user-timezone";
import { ArrowDownLeft, ArrowUpRight, Banknote, Clock, History, Wallet } from "lucide-react";
import {
  lowestCpaMinPayout,
  type CpaMinPayoutSettings,
} from "@/components/advertiser/advertiser-cpa-payout-request-form";
import { formatCurrency } from "@/components/admin/admin-ui";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { ButtonLink } from "@/components/ui/button-link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  CpaWalletActivityRow,
  CpaWalletSummary,
} from "@/services/cpa-wallet.service";
import { cn } from "@/lib/utils";

type WalletSnapshot = {
  balances: CpaWalletSummary;
  activity: CpaWalletActivityRow[];
  summary: {
    last7d: { earnings: number; withdrawals: number };
    last30d: { earnings: number; withdrawals: number };
  };
};

function ActivityStatusBadge({ row }: { row: CpaWalletActivityRow }) {
  if (row.activity === "Earnings" && row.status === "pending") {
    const label =
      row.availableInDays != null && row.availableInDays > 0
        ? `Available in ${row.availableInDays} day${row.availableInDays === 1 ? "" : "s"}`
        : "Pending";

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            type="button"
            className="inline-flex cursor-help items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200"
          >
            <Clock className="h-3 w-3" />
            pending
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const styles: Record<CpaWalletActivityRow["status"], string> = {
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    available: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    processing: "bg-sky-50 text-sky-700 ring-sky-200",
    completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    rejected: "bg-red-50 text-red-700 ring-red-200",
    failed: "bg-red-50 text-red-700 ring-red-200",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
        styles[row.status],
      )}
    >
      {row.status}
    </span>
  );
}

export function AdvertiserCpaWallet({
  snapshot,
  minPayoutSettings,
  timezone,
}: {
  snapshot: WalletSnapshot;
  minPayoutSettings: CpaMinPayoutSettings;
  timezone?: string;
}) {
  const [tab, setTab] = useState<"activity" | "summary">("activity");
  const { balances, activity, summary } = snapshot;
  const lowestMin = lowestCpaMinPayout(minPayoutSettings);
  const canWithdraw = balances.availableBalance >= lowestMin;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="CPA Offers"
        title="Wallet"
        description="Track CPA earnings, pending hold, and withdrawals"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GradientStatCard
          variant="approved"
          label="Available Balance"
          value={formatCurrency(balances.availableBalance)}
          icon={Wallet}
        />
        <NeutralStatCard
          label="Pending (7-day hold)"
          value={formatCurrency(balances.pendingBalance)}
          icon={Clock}
          accent="orange"
        />
        <NeutralStatCard
          label="Minimum Withdrawal"
          value={formatCurrency(lowestMin)}
          icon={Banknote}
          accent="purple"
        />
      </div>

      <PageSection
        title="Quick Withdraw"
        description="Request a payout once your available balance meets the minimum"
        icon={ArrowDownLeft}
        gradient="approved"
        contentClassName="p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Ready to withdraw</p>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(balances.availableBalance)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Minimum withdrawal: {formatCurrency(lowestMin)}
            </p>
          </div>
          {canWithdraw ? (
            <ButtonLink
              href="/advertiser/cpa-offers/wallet/withdraw"
              className="h-10 rounded-xl bg-emerald-600 px-6 hover:bg-emerald-700"
            >
              Withdraw
            </ButtonLink>
          ) : (
            <Button disabled className="h-10 rounded-xl bg-emerald-600 px-6 opacity-50">
              Withdraw
            </Button>
          )}
        </div>
      </PageSection>

      <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {(
          [
            { id: "activity", label: "Recent Activity" },
            { id: "summary", label: "Summary" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === item.id
                ? "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "activity" ? (
        <PageSection
          title="Recent Activity"
          description="CPA earnings and withdrawal requests"
          icon={History}
          gradient="leads"
          contentClassName="p-0"
        >
          {activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <Wallet className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">No activity yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                CPA conversions will appear here after postbacks are received.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow
                    className="border-none hover:bg-transparent"
                    style={{ background: "var(--theme-primary-soft)" }}
                  >
                    <TableHead className="h-11 px-6 text-muted-foreground">Activity</TableHead>
                    <TableHead className="h-11 px-4 text-muted-foreground">Type</TableHead>
                    <TableHead className="h-11 px-4 text-muted-foreground">Details</TableHead>
                    <TableHead className="h-11 px-4 text-right text-muted-foreground">Amount</TableHead>
                    <TableHead className="h-11 px-4 text-muted-foreground">Date</TableHead>
                    <TableHead className="h-11 px-6 text-muted-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.map((row) => (
                    <TableRow key={`${row.activity}-${row.id}`} className="border-border">
                      <TableCell className="px-6 py-4">
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                          {row.activity === "Earnings" ? (
                            <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          {row.activity}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-sm text-muted-foreground">{row.type}</TableCell>
                      <TableCell className="px-4 py-4 text-sm text-foreground">{row.details}</TableCell>
                      <TableCell
                        className={cn(
                          "px-4 py-4 text-right text-sm font-semibold tabular-nums",
                          row.amount >= 0 ? "text-emerald-600" : "text-foreground",
                        )}
                      >
                        {row.amount >= 0 ? "+" : ""}
                        {formatCurrency(Math.abs(row.amount))}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                        {formatUserDateTime(row.date, timezone, "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <ActivityStatusBadge row={row} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </PageSection>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              { label: "Last 7 days", data: summary.last7d },
              { label: "Last 30 days", data: summary.last30d },
            ] as const
          ).map((period) => (
            <div
              key={period.label}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-2">
                <Banknote className="h-4 w-4 text-[var(--theme-primary)]" />
                <h3 className="font-semibold text-foreground">{period.label}</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-emerald-700">Earnings</p>
                  <p className="mt-1 text-xl font-bold text-emerald-800">
                    {formatCurrency(period.data.earnings)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Withdrawals</p>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {formatCurrency(period.data.withdrawals)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
