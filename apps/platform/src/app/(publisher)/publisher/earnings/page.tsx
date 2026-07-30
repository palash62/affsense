export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { formatUserDateTime } from "@/lib/user-timezone";
import { ArrowDownLeft, Banknote, CheckCircle, Clock, History, Plus, TrendingUp, Wallet } from "lucide-react";
import { getSession } from "@/lib/session";
import { getWalletBalance, listPublisherLedger } from "@/services/wallet.service";
import { listPayouts } from "@/services/payout.service";
import { prisma } from "@/lib/prisma";
import { PENDING_PAYOUT_STATUSES } from "@/lib/payout-status";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { PageSection } from "@/components/admin/page-section";
import { formatCurrency, PayoutStatusBadge } from "@/components/admin/admin-ui";
import { UsersTablePagination } from "@/components/admin/users-table-pagination";
import { RoleHero } from "@/components/layout/role-hero";
import { AdvertiserLeadsTableFooter } from "@/components/advertiser/advertiser-leads-table-footer";
import { PublisherInfoBanner } from "@/components/publisher/publisher-info-banner";
import {
  PublisherEarningsTabNav,
  type PublisherEarningsTab,
} from "@/components/publisher/publisher-earnings-tab-nav";
import { PublisherPayoutsSortHeader } from "@/components/publisher/publisher-payouts-sort-header";
import { PublisherPayoutsFilters } from "@/components/publisher/publisher-payouts-filters";
import { formatPayoutMethod } from "@/lib/payout";
import { payoutDetailsSummary } from "@/lib/payout-payment-details";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    sort?: string;
    status?: string;
    method?: string;
    from?: string;
    to?: string;
  }>;
}

function shortLedgerId(id: string) {
  return id.slice(-8).toUpperCase();
}

function shortPayoutId(id: string) {
  return id.slice(-8).toUpperCase();
}

function hasPayoutFilters(params: {
  status?: string;
  method?: string;
  from?: string;
  to?: string;
}) {
  return Boolean(params.status || params.method || params.from || params.to);
}

function parseTab(tab?: string): PublisherEarningsTab {
  return tab === "payouts" ? "payouts" : "earnings";
}

export default async function PublisherEarningsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const tz = session.user.timezone;

  const params = await searchParams;
  const tab = parseTab(params.tab);
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 10;
  const userId = session.user.id;

  const [balance, approvedLeads, pendingPayouts] = await Promise.all([
    getWalletBalance(userId),
    prisma.lead.count({
      where: { publisherId: userId, status: { in: ["APPROVED", "PAID"] } },
    }),
    prisma.payout.count({
      where: { publisherId: userId, status: { in: [...PENDING_PAYOUT_STATUSES] } },
    }),
  ]);

  const wallet = balance ?? {
    balance: 0,
    holdBalance: 0,
    availableBalance: 0,
    currency: "USD",
  };

  const ledger =
    tab === "earnings"
      ? await listPublisherLedger(userId, { page, limit })
      : null;

  const payoutsResult =
    tab === "payouts"
      ? await listPayouts({
          publisherId: userId,
          status: params.status,
          method: params.method,
          dateFrom: params.from ? new Date(params.from) : undefined,
          dateTo: params.to ? new Date(params.to) : undefined,
          sort: params.sort,
          page,
          limit,
        })
      : null;

  const payoutFiltersActive = hasPayoutFilters(params);

  const totalEarned =
    tab === "earnings" && ledger ? ledger.totalEarned : wallet.balance;

  return (
    <div className="space-y-7">
      <RoleHero
        eyebrow="Publisher Portal"
        title="Earnings & Payouts"
        description="View your balance, earnings history, and payout requests in one place."
        action={{ label: "Request Payout", href: "/publisher/payouts/request", icon: Plus }}
      />

      <PublisherInfoBanner>
        Earnings are credited to your wallet when leads are paid. Approved leads show an estimated
        payout until payment completes. Request a payout once your available balance meets the
        platform minimum.
      </PublisherInfoBanner>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GradientStatCard
          variant="revenue"
          label="Available Balance"
          value={formatCurrency(wallet.availableBalance)}
          icon={Wallet}
        />
        <NeutralStatCard
          label="Total Earned"
          value={formatCurrency(totalEarned)}
          icon={TrendingUp}
          accent="green"
        />
        <NeutralStatCard
          label="Pending Payouts"
          value={pendingPayouts}
          icon={Clock}
          accent="orange"
        />
        <NeutralStatCard
          label="Approved Leads"
          value={approvedLeads}
          icon={CheckCircle}
          accent="purple"
        />
      </div>

      <Suspense fallback={<div className="h-[72px] w-full animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />}>
        <PublisherEarningsTabNav active={tab} />
      </Suspense>

      {tab === "earnings" ? (
        <>
          <PageSection
            title="Quick Payout"
            description="Withdraw your available earnings"
            icon={ArrowDownLeft}
            gradient="revenue"
            contentClassName="p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-500">Ready to withdraw</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(wallet.availableBalance)}
                </p>
              </div>
              <ButtonLink
                href="/publisher/payouts/request"
                className="h-10 rounded-xl bg-[var(--theme-primary)] px-6 hover:opacity-90"
              >
                Request Payout
              </ButtonLink>
            </div>
          </PageSection>

          <div className="premium-card overflow-hidden">
            <div className="h-1" style={{ background: "var(--theme-gradient-approved)" }} />
            <div className="border-b border-slate-100 bg-[var(--theme-primary-soft)] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                  <Wallet className="h-5 w-5 text-[var(--theme-primary)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Balance details</h2>
                  <p className="text-sm text-slate-500">How your earnings balance is calculated</p>
                </div>
              </div>
            </div>
            <div className="grid gap-0 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
              <div className="flex items-center justify-between px-6 py-4 sm:flex-col sm:items-start sm:gap-1">
                <span className="text-sm text-slate-500">Total balance</span>
                <span className="text-sm font-semibold text-slate-900">
                  {formatCurrency(wallet.balance)}
                </span>
              </div>
              <div className="flex items-center justify-between px-6 py-4 sm:flex-col sm:items-start sm:gap-1">
                <span className="text-sm text-slate-500">On hold</span>
                <span className="text-sm font-semibold text-amber-600">
                  {formatCurrency(wallet.holdBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between px-6 py-4 sm:flex-col sm:items-start sm:gap-1">
                <span className="text-sm text-slate-500">Available</span>
                <span className="text-sm font-semibold text-emerald-600">
                  {formatCurrency(wallet.availableBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between px-6 py-4 sm:flex-col sm:items-start sm:gap-1">
                <span className="text-sm text-slate-500">Lifetime earned</span>
                <span className="text-sm font-semibold text-slate-900">
                  {formatCurrency(ledger?.totalEarned ?? wallet.balance)}
                </span>
              </div>
            </div>
          </div>

          <PageSection
            title="Earnings Ledger"
            description="Credit entries from paid leads"
            icon={History}
            gradient="leads"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow
                    className="border-none hover:bg-transparent"
                    style={{ background: "var(--theme-primary-soft)" }}
                  >
                    <TableHead className="h-11 px-6 text-slate-600">Date</TableHead>
                    <TableHead className="h-11 px-4 text-slate-600">Reference</TableHead>
                    <TableHead className="h-11 px-4 text-slate-600">Description</TableHead>
                    <TableHead className="h-11 px-4 text-right text-slate-600">Amount</TableHead>
                    <TableHead className="h-11 px-6 text-right text-slate-600">Balance After</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!ledger || ledger.data.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="px-6 py-16 text-center text-slate-500">
                        No earnings yet. Paid leads will appear here.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ledger.data.map((entry) => (
                      <TableRow
                        key={entry.id}
                        className="border-slate-100 transition-colors hover:bg-blue-50/40"
                      >
                        <TableCell className="px-6 py-4 text-sm text-slate-700">
                          {formatUserDateTime(entry.createdAt, tz, "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="px-4 py-4 font-mono text-xs text-slate-500">
                          {shortLedgerId(entry.referenceId ?? entry.id)}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-600">
                          {entry.description ?? entry.referenceType}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-emerald-600">
                          +{formatCurrency(entry.amount)}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right text-sm font-medium tabular-nums text-slate-700">
                          {formatCurrency(entry.balanceAfter)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {ledger && ledger.meta.total > 0 && (
              <Suspense fallback={null}>
                <AdvertiserLeadsTableFooter
                  page={ledger.meta.page}
                  totalPages={ledger.meta.totalPages}
                  total={ledger.meta.total}
                  perPage={ledger.meta.limit}
                />
              </Suspense>
            )}
          </PageSection>
        </>
      ) : (
        <PageSection
          title="Payout Requests"
          description={`${payoutsResult?.meta.total ?? 0} payout request${payoutsResult?.meta.total === 1 ? "" : "s"} total`}
          icon={Banknote}
          gradient="revenue"
          contentClassName="p-0"
        >
          <Suspense fallback={null}>
            <PublisherPayoutsFilters />
          </Suspense>

          {!payoutsResult || payoutsResult.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: "var(--theme-primary-soft)" }}
              >
                <Banknote className="h-7 w-7 text-[var(--theme-primary)]" />
              </div>
              {payoutFiltersActive ? (
                <>
                  <h3 className="text-lg font-semibold text-slate-900">No payouts match your filters</h3>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">
                    Try adjusting the status, method, or date range, then apply again.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-slate-900">No payout history yet</h3>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">
                    Once you have available earnings, you can request a payout.
                  </p>
                  <ButtonLink
                    href="/publisher/payouts/request"
                    className="mt-4 h-9 gap-1.5 rounded-lg bg-[var(--theme-primary)] px-4 text-sm hover:opacity-90"
                  >
                    <Plus className="h-4 w-4" />
                    Request Payout
                  </ButtonLink>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow
                    className="border-none hover:bg-transparent"
                    style={{ background: "var(--theme-primary-soft)" }}
                  >
                    <TableHead className="h-11 px-6 text-slate-600">
                      <Suspense fallback={<span>Requested</span>}>
                        <PublisherPayoutsSortHeader field="date" label="Requested" />
                      </Suspense>
                    </TableHead>
                    <TableHead className="h-11 px-4 text-right text-slate-600">
                      <Suspense fallback={<span>Amount</span>}>
                        <PublisherPayoutsSortHeader field="amount" label="Amount" align="right" />
                      </Suspense>
                    </TableHead>
                    <TableHead className="h-11 px-4 text-slate-600">
                      <Suspense fallback={<span>Method</span>}>
                        <PublisherPayoutsSortHeader field="method" label="Method" />
                      </Suspense>
                    </TableHead>
                    <TableHead className="h-11 px-4 text-slate-600">Destination</TableHead>
                    <TableHead className="h-11 px-4 text-slate-600">
                      <Suspense fallback={<span>Status</span>}>
                        <PublisherPayoutsSortHeader field="status" label="Status" />
                      </Suspense>
                    </TableHead>
                    <TableHead className="h-11 px-6 text-slate-600">Processed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payoutsResult.data.map((payout) => (
                    <TableRow
                      key={payout.id}
                      className="border-slate-100 transition-colors hover:bg-blue-50/40"
                    >
                      <TableCell className="px-6 py-4">
                        <p className="text-sm text-slate-700">
                          {formatUserDateTime(payout.createdAt, tz, "MMM d, yyyy HH:mm")}
                        </p>
                        <p className="font-mono text-xs text-slate-400">
                          {shortPayoutId(payout.id)}
                        </p>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-slate-900">
                        {formatCurrency(Number(payout.amount))}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-sm text-slate-600">
                        {formatPayoutMethod(payout.method)}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate px-4 py-4 text-xs text-slate-500">
                        {payoutDetailsSummary(payout.method, payout.paymentDetails)}
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="space-y-1">
                          <PayoutStatusBadge status={payout.status} />
                          {payout.status === "REJECTED" && payout.rejectionReason && (
                            <p className="max-w-xs text-xs text-red-600">{payout.rejectionReason}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-slate-600">
                        {payout.processedAt ? formatUserDateTime(payout.processedAt, tz, "MMM d, yyyy") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              <Suspense>
                <UsersTablePagination
                  page={payoutsResult.meta.page}
                  totalPages={payoutsResult.meta.totalPages}
                  total={payoutsResult.meta.total}
                />
              </Suspense>
            </>
          )}
        </PageSection>
      )}
    </div>
  );
}
