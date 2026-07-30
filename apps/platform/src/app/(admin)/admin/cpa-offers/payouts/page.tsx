import { Suspense } from "react";
import { formatUserDateTime } from "@/lib/user-timezone";
import { getSession } from "@/lib/session";
import { ArrowUpFromLine, Banknote, Clock, DollarSign, History, Wallet } from "lucide-react";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { formatCurrency, PayoutStatusBadge } from "@/components/admin/admin-ui";
import { AdminPayoutReviewDialog } from "@/components/admin/admin-payout-review-dialog";
import { UsersTablePagination } from "@/components/admin/users-table-pagination";
import { formatPayoutMethod } from "@/lib/payout";
import { payoutDetailsSummary } from "@/lib/payout-payment-details";
import { listAdminPayouts, listPendingCpaPayouts } from "@/services/payout.service";
import { Badge } from "@/components/ui/badge";
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
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminCpaPayoutsPage({ searchParams }: PageProps) {
  const session = await getSession();
  const tz = session?.user?.timezone;
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const [pendingPayouts, history] = await Promise.all([
    listPendingCpaPayouts(),
    listAdminPayouts({
      kind: "CPA",
      page,
      limit: 20,
    }),
  ]);

  const totalPending = pendingPayouts.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalHistoryAmount = history.data.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow="CPA Offers"
        title="CPA Payouts"
        description="Review and approve advertiser CPA wallet withdrawal requests"
        badge={pendingPayouts.length > 0 ? `${pendingPayouts.length} pending` : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <GradientStatCard
          variant="approved"
          label="Pending Amount"
          value={formatCurrency(totalPending)}
          icon={DollarSign}
        />
        <NeutralStatCard
          label="Pending Requests"
          value={pendingPayouts.length}
          icon={Clock}
          accent="orange"
        />
        <NeutralStatCard
          label="History (this page)"
          value={formatCurrency(totalHistoryAmount)}
          icon={History}
          accent="purple"
        />
      </div>

      {pendingPayouts.length > 0 && (
        <PageSection
          title="Pending CPA Payouts"
          description="Advertiser CPA wallet withdrawals awaiting approval"
          icon={Wallet}
          gradient="approved"
        >
          <Table>
            <TableHeader>
              <TableRow
                className="border-none hover:bg-transparent"
                style={{ background: "var(--theme-primary-soft)" }}
              >
                <TableHead className="h-11 px-6 text-slate-600">Requested</TableHead>
                <TableHead className="h-11 px-4 text-slate-600">Advertiser</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Amount</TableHead>
                <TableHead className="h-11 px-4 text-slate-600">Method</TableHead>
                <TableHead className="h-11 px-4 text-slate-600">Destination</TableHead>
                <TableHead className="h-11 px-4 text-slate-600">Status</TableHead>
                <TableHead className="h-11 px-6 text-right text-slate-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingPayouts.map((payout) => (
                <TableRow
                  key={payout.id}
                  className="border-slate-100 transition-colors hover:bg-emerald-50/40"
                >
                  <TableCell className="px-6 py-4 text-sm text-slate-600">
                    {formatUserDateTime(payout.createdAt, tz, "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <p className="font-medium text-slate-900">{payout.publisher.name}</p>
                    <p className="text-xs text-slate-500">{payout.publisher.email}</p>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-right">
                    <span className="text-lg font-bold text-emerald-600">
                      {formatCurrency(Number(payout.amount))}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-sm text-slate-600">
                    {formatPayoutMethod(payout.method)}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate px-4 py-4 text-xs text-slate-500">
                    {payoutDetailsSummary(payout.method, payout.paymentDetails)}
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <PayoutStatusBadge status={payout.status} />
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <AdminPayoutReviewDialog payout={payout} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PageSection>
      )}

      <PageSection
        title="CPA Payout History"
        description="All advertiser CPA wallet withdrawal requests"
        icon={ArrowUpFromLine}
        gradient="approved"
        contentClassName="p-0"
      >
        {history.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "var(--theme-primary-soft)" }}
            >
              <Banknote className="h-7 w-7 text-[var(--theme-primary)]" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No CPA payouts yet</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Advertiser CPA wallet withdrawals will appear here once requested.
            </p>
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
                    <TableHead className="h-11 px-6 text-slate-600">Requested</TableHead>
                    <TableHead className="h-11 px-4 text-slate-600">Advertiser</TableHead>
                    <TableHead className="h-11 px-4 text-right text-slate-600">Amount</TableHead>
                    <TableHead className="h-11 px-4 text-slate-600">Method</TableHead>
                    <TableHead className="h-11 px-4 text-slate-600">Destination</TableHead>
                    <TableHead className="h-11 px-4 text-slate-600">Status</TableHead>
                    <TableHead className="h-11 px-4 text-slate-600">Processed</TableHead>
                    <TableHead className="h-11 px-6 text-right text-slate-600">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.data.map((payout) => (
                    <TableRow
                      key={payout.id}
                      className="border-slate-100 transition-colors hover:bg-emerald-50/40"
                    >
                      <TableCell className="px-6 py-4 text-sm text-slate-600">
                        {formatUserDateTime(payout.createdAt, tz, "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <p className="font-medium text-slate-900">{payout.publisher.name}</p>
                        <p className="text-xs text-slate-500">{payout.publisher.email}</p>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <span className="font-semibold tabular-nums text-emerald-600">
                          {formatCurrency(Number(payout.amount))}
                        </span>
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
                      <TableCell className="px-4 py-4 text-sm text-slate-600">
                        {payout.processedAt
                          ? formatUserDateTime(payout.processedAt, tz, "MMM d, yyyy HH:mm")
                          : "—"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <Badge variant="outline" className="mr-2 font-medium">
                          CPA
                        </Badge>
                        <AdminPayoutReviewDialog payout={payout} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Suspense fallback={null}>
              <UsersTablePagination
                page={history.meta.page}
                totalPages={history.meta.totalPages}
                total={history.meta.total}
              />
            </Suspense>
          </>
        )}
      </PageSection>
    </div>
  );
}
