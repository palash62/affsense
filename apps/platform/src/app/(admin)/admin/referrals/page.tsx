import { Suspense } from "react";
import Link from "next/link";
import { formatUserDateTime } from "@/lib/user-timezone";
import { getSession } from "@/lib/session";
import { Gift, Users, Wallet, Clock, DollarSign } from "lucide-react";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { formatCurrency, UserStatusBadge } from "@/components/admin/admin-ui";
import { AdminReferralsFilters } from "@/components/admin/admin-referrals-filters";
import { getAdminReferralReport } from "@/services/referral.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function AdminReferralsPage({ searchParams }: PageProps) {
  const session = await getSession();
  const tz = session?.user?.timezone;
  const params = await searchParams;
  const report = await getAdminReferralReport({ q: params.q });

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow="Finance"
        title="Referrals"
        description="See who referred whom and how much referral commission each relationship has earned"
        badge={`${report.stats.totalReferred} referred`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GradientStatCard
          variant="leads"
          label="Active Referrers"
          value={report.stats.activeReferrers}
          icon={Users}
        />
        <NeutralStatCard
          label="Referred Users"
          value={report.stats.totalReferred}
          icon={Gift}
          accent="purple"
        />
        <GradientStatCard
          variant="revenue"
          label="Total Commissions"
          value={formatCurrency(report.stats.totalCommission)}
          icon={DollarSign}
        />
        <NeutralStatCard
          label="Pending Payouts"
          value={formatCurrency(report.stats.pendingReferralPayout)}
          icon={Clock}
          accent="orange"
        />
      </div>

      <PageSection
        title="Referral Report"
        description="Who referred whom, ad spend by referred advertisers, and commissions paid to referrers"
        icon={Wallet}
        gradient="revenue"
        contentClassName="space-y-4 p-6"
      >
        <Suspense fallback={null}>
          <AdminReferralsFilters />
        </Suspense>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow
                className="border-none hover:bg-transparent"
                style={{ background: "var(--theme-primary-soft)" }}
              >
                <TableHead className="h-11 px-6 text-slate-600">Referrer</TableHead>
                <TableHead className="h-11 px-4 text-slate-600">Referred</TableHead>
                <TableHead className="h-11 px-4 text-slate-600">Joined</TableHead>
                <TableHead className="h-11 px-4 text-slate-600">Status</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Ad Spend</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="px-6 py-16 text-center text-slate-500">
                    No referral relationships found.
                  </TableCell>
                </TableRow>
              ) : (
                report.rows.map((row) => (
                  <TableRow
                    key={row.referredId}
                    className="border-slate-100 transition-colors hover:bg-blue-50/40"
                  >
                    <TableCell className="px-6 py-4">
                      <div>
                        <Link
                          href={`/admin/advertisers/${row.referrerId}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {row.referrerName}
                        </Link>
                        <p className="text-xs text-slate-500">{row.referrerEmail}</p>
                        {row.referrerCode && (
                          <p className="mt-1 text-xs font-medium text-slate-400">
                            Code: {row.referrerCode}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div>
                        <Link
                          href={`/admin/advertisers/${row.referredId}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {row.referredName}
                        </Link>
                        <p className="text-xs text-slate-500">{row.referredEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-slate-600">
                      {formatUserDateTime(row.joinedAt, tz, "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <UserStatusBadge
                        status={row.referredStatus as "ACTIVE" | "PENDING" | "SUSPENDED"}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm font-medium tabular-nums text-slate-700">
                      {formatCurrency(row.adSpend)}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-emerald-600">
                      {formatCurrency(row.commission)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {params.q && report.rows.length > 0 && (
          <p className="text-xs text-slate-500">
            Filtered totals: {formatCurrency(report.stats.filteredAdSpend)} ad spend,{" "}
            {formatCurrency(report.stats.filteredCommission)} commission
          </p>
        )}
      </PageSection>
    </div>
  );
}
