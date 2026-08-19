import { Suspense } from "react";
import {
  getAdminDepositStats,
  listAdminDeposits,
  listDepositAdvertiserOptions,
  listPendingDeposits,
} from "@/services/wallet.service";
import { Clock, DollarSign, History, Wallet } from "lucide-react";
import { formatUserDateTime } from "@/lib/user-timezone";
import { getSession } from "@/lib/session";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { DepositStatusBadge, formatCurrency } from "@/components/admin/admin-ui";
import { AdminDepositReviewDialog } from "@/components/admin/admin-deposit-review-dialog";
import { AdminDepositsFilters } from "@/components/admin/admin-deposits-filters";
import { UsersTablePagination } from "@/components/admin/users-table-pagination";
import { formatDepositMethod, serializeAdminDepositRow } from "@/lib/deposit";
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
  searchParams: Promise<{
    advertiser?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

function depositDialogProps(deposit: Awaited<ReturnType<typeof listAdminDeposits>>["data"][number]) {
  return serializeAdminDepositRow(deposit);
}

export default async function AdminDepositsPage({ searchParams }: PageProps) {
  const session = await getSession();
  const tz = session?.user?.timezone;
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const [pendingDeposits, history, advertisers, stats] = await Promise.all([
    listPendingDeposits(),
    listAdminDeposits({
      advertiserId: params.advertiser,
      dateFrom: params.from ? new Date(params.from) : undefined,
      dateTo: params.to ? new Date(params.to) : undefined,
      page,
      limit: 20,
    }),
    listDepositAdvertiserOptions(),
    getAdminDepositStats(),
  ]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <GradientStatCard
          variant="revenue"
          label="Total Deposits"
          value={formatCurrency(stats.totalAmount)}
          icon={DollarSign}
        />
        <NeutralStatCard label="Pending Deposits" value={stats.pendingCount} icon={Clock} accent="orange" />
        <NeutralStatCard
          label="This Month"
          value={formatCurrency(stats.thisMonthAmount)}
          icon={Wallet}
          accent="purple"
        />
      </div>

      {pendingDeposits.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            Pending Wise deposits
            <span className="ml-2 font-normal text-muted-foreground">
              Credit card deposits are approved automatically
            </span>
          </p>
          <div className="overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent bg-muted/60">
                    <TableHead className="h-11 px-6 text-muted-foreground">Submitted</TableHead>
                    <TableHead className="h-11 px-4 text-muted-foreground">Advertiser</TableHead>
                    <TableHead className="h-11 px-4 text-right text-muted-foreground">Amount</TableHead>
                    <TableHead className="h-11 px-4 text-muted-foreground">Reference</TableHead>
                    <TableHead className="h-11 px-4 text-muted-foreground">Status</TableHead>
                    <TableHead className="h-11 px-6 text-right text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingDeposits.map((deposit) => (
                    <TableRow key={deposit.id} className="border-border transition-colors hover:bg-muted/40">
                      <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                        {formatUserDateTime(deposit.createdAt, tz, "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <p className="font-medium text-foreground">{deposit.user.name}</p>
                        <p className="text-xs text-muted-foreground">{deposit.user.email}</p>
                        {deposit.user.advertiserProfile?.company ? (
                          <p className="text-xs text-muted-foreground">{deposit.user.advertiserProfile.company}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <span className="text-lg font-bold text-emerald-600">
                          {formatCurrency(Number(deposit.amount))}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-4 font-mono text-xs text-muted-foreground">
                        {deposit.wiseReference ?? "—"}
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <DepositStatusBadge status={deposit.status} />
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <AdminDepositReviewDialog deposit={depositDialogProps(deposit)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">All advertiser deposits — filter by advertiser or date range</p>
        <div className="overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]">
          <Suspense fallback={null}>
            <AdminDepositsFilters advertisers={advertisers} />
          </Suspense>

          {history.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center border-t border-dashed border-border px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--theme-primary-soft)]">
                <History className="h-6 w-6 text-[var(--theme-primary)]" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">No deposits found</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Try adjusting the advertiser or date filters.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent bg-muted/60">
                      <TableHead className="h-11 px-6 text-muted-foreground">Date</TableHead>
                      <TableHead className="h-11 px-4 text-muted-foreground">Advertiser</TableHead>
                      <TableHead className="h-11 px-4 text-right text-muted-foreground">Amount</TableHead>
                      <TableHead className="h-11 px-4 text-muted-foreground">Method</TableHead>
                      <TableHead className="h-11 px-4 text-muted-foreground">Reference</TableHead>
                      <TableHead className="h-11 px-4 text-muted-foreground">Status</TableHead>
                      <TableHead className="h-11 px-6 text-right text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.data.map((deposit) => (
                      <TableRow key={deposit.id} className="border-border transition-colors hover:bg-muted/40">
                        <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                          {formatUserDateTime(deposit.createdAt, tz, "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="px-4 py-4">
                          <p className="font-medium text-foreground">{deposit.user.name}</p>
                          <p className="text-xs text-muted-foreground">{deposit.user.email}</p>
                          {deposit.user.advertiserProfile?.company ? (
                            <p className="text-xs text-muted-foreground">{deposit.user.advertiserProfile.company}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-right">
                          <span className="font-semibold tabular-nums text-emerald-600">
                            {formatCurrency(Number(deposit.amount))}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                          {formatDepositMethod(deposit.method)}
                        </TableCell>
                        <TableCell className="px-4 py-4 font-mono text-xs text-muted-foreground">
                          {deposit.method === "WISE" ? (deposit.wiseReference ?? "—") : "—"}
                        </TableCell>
                        <TableCell className="px-4 py-4">
                          <DepositStatusBadge status={deposit.status} />
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right">
                          {deposit.method === "WISE" ? (
                            <AdminDepositReviewDialog deposit={depositDialogProps(deposit)} />
                          ) : (
                            <span className="text-xs text-muted-foreground">Auto-approved</span>
                          )}
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
        </div>
      </div>
    </div>
  );
}
