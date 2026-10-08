"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Link2, Users } from "lucide-react";
import {
  DashboardCard,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import { DashboardViewAllLink } from "@/components/publisher/affsense-dashboard/dashboard-source-chip";
import { buildPublisherReferralUrl } from "@/lib/referral";
import { cn } from "@/lib/utils";

export type ReferralsOverviewData = {
  referralCode: string;
  total: number;
  totalTrend: number;
  active: number;
  totalEarnings: number;
  pendingEarnings: number;
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function ReferralsOverview({ data }: { data: ReferralsOverviewData }) {
  const [copied, setCopied] = useState(false);
  const trendUp = data.totalTrend >= 0;
  // Resolve origin after mount so server and client render the same markup.
  const [referralUrl, setReferralUrl] = useState(
    () => `/register?referral_by=${encodeURIComponent(data.referralCode)}`,
  );

  useEffect(() => {
    setReferralUrl(buildPublisherReferralUrl(window.location.origin, data.referralCode));
  }, [data.referralCode]);

  async function copyLink() {
    await navigator.clipboard.writeText(
      buildPublisherReferralUrl(window.location.origin, data.referralCode),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2">
        <DashboardCardTitle>Referrals Overview</DashboardCardTitle>
        <DashboardViewAllLink href="/publisher/referrals" />
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tracking-tight text-foreground">
            {data.total.toLocaleString("en-US")}
          </p>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            Total Referrals
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-semibold",
                trendUp ? "text-[var(--theme-success)]" : "text-destructive",
              )}
            >
              {trendUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {Math.abs(data.totalTrend)}%
            </span>
          </p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--theme-primary-soft)]">
          <Users className="h-5 w-5 text-[var(--theme-primary)]" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <div>
          <p className="text-base font-bold text-foreground">{data.active.toLocaleString("en-US")}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Active Referrals</p>
        </div>
        <div>
          <p className="text-base font-bold text-foreground">{formatMoney(data.totalEarnings)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Total Earnings</p>
        </div>
        <div>
          <p className="text-base font-bold text-foreground">{formatMoney(data.pendingEarnings)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Next Invoice</p>
        </div>
      </div>

      <div className="min-h-5 flex-1" />
      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
        Your referral link · 10% Digital, 5% CPA
      </p>
      <input
        readOnly
        value={referralUrl}
        aria-label="Your referral link"
        onFocus={(event) => event.currentTarget.select()}
        className="mb-2 h-9 w-full min-w-0 rounded-lg border border-border bg-card px-3 text-xs text-foreground"
      />
      <button
        type="button"
        onClick={copyLink}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--theme-primary-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--theme-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--theme-primary)_18%,white)]"
      >
        {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
        {copied ? "Copied" : "Copy Your Referral Link"}
      </button>
    </DashboardCard>
  );
}
