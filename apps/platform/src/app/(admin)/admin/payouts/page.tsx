import { Suspense } from "react";
import { formatUserDateTime } from "@/lib/user-timezone";
import { getSession } from "@/lib/session";
import { ArrowUpFromLine, Banknote, Clock, DollarSign, History, Wallet } from "lucide-react";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { formatCurrency, PayoutStatusBadge } from "@/components/admin/admin-ui";
import { AdminPayoutReviewDialog } from "@/components/admin/admin-payout-review-dialog";
import { AdminPayoutsFilters } from "@/components/admin/admin-payouts-filters";
import { UsersTablePagination } from "@/components/admin/users-table-pagination";
import { formatPayoutMethod } from "@/lib/payout";
import { payoutDetailsSummary } from "@/lib/payout-payment-details";
import {
  listAdminPayouts,
  listPendingPayouts,
  listPayoutPublisherOptions,
} from "@/services/payout.service";
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
  searchParams: Promise<{
    publisher?: string;
    kind?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function AdminPayoutsPage({ searchParams }: PageProps) {
  const session = await getSession();
  const tz = session?.user?.timezone;
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const [pendingPayouts, history, publishers] = await Promise.all([
    listPendingPayouts(),
    listAdminPayouts({
      publisherId: params.publisher,
      kind: (params.kind as "PUBLISHER" | "REFERRAL" | "all" | undefined) ?? "all",
      status: params.status,
      dateFrom: params.from ? new Date(params.from) : undefined,
      dateTo: params.to ? new Date(params.to) : undefined,
      page,
      limit: 20,
    }),
    listPayoutPublisherOptions(),
  ]);

  const totalPending = pendingPayouts.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalHistoryAmount = history.data.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow="Finance"
        title="Payouts"
        description="Approve publisher and referral withdrawals and review payout history"
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
          title="Pending Payouts"
          description="Requests awaiting admin approval"
          icon={Wallet}
          gradient="approved"
        >
          <Table>
            <TableHeader>
              <TableRow
                className="border-none hover:bg-transparent"
                style={{ background: "var(--theme-primary-soft)" }}
              >
                <TableHead className="h-11 px-6 text-muted-foreground">Requested</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Kind</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">User</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Amount</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Method</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Destination</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Status</TableHead>
                <TableHead className="h-11 px-6 text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingPayouts.map((payout) => (
                <TableRow
                  key={payout.id}
                  className="border-border transition-colors hover:bg-emerald-50/40"
                >
                  <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                    {formatUserDateTime(payout.createdAt, tz, "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <Badge variant="outline" className="font-medium capitalize">
                      {payout.kind === "REFERRAL" ? "Referral" : "Publisher"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <p className="font-medium text-foreground">{payout.publisher.name}</p>
                    <p className="text-xs text-muted-foreground">{payout.publisher.email}</p>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-right">
                    <span className="text-lg font-bold text-emerald-600">
                      {formatCurrency(Number(payout.amount))}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                    {formatPayoutMethod(payout.method)}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate px-4 py-4 text-xs text-muted-foreground">
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
        title="Payout History"
        description="All payout requests — filter by user, kind, status, or date range"
        icon={ArrowUpFromLine}
        gradient="approved"
        contentClassName="p-0"
      >
        <Suspense fallback={null}>
          <AdminPayoutsFilters publishers={publishers} />
        </Suspense>

        {history.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "var(--theme-primary-soft)" }}
            >
              <Banknote className="h-7 w-7 text-[var(--theme-primary)]" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No payouts found</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Try adjusting the publisher, status, or date filters.
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
                    <TableHead className="h-11 px-6 text-muted-foreground">Requested</TableHead>
                    <TableHead className="h-11 px-4 text-muted-foreground">Kind</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">User</TableHead>
                    <TableHead className="h-11 px-4 text-right text-muted-foreground">Amount</TableHead>
                    <TableHead className="h-11 px-4 text-muted-foreground">Method</TableHead>
                    <TableHead className="h-11 px-4 text-muted-foreground">Destination</TableHead>
                    <TableHead className="h-11 px-4 text-muted-foreground">Status</TableHead>
                    <TableHead className="h-11 px-4 text-muted-foreground">Processed</TableHead>
                    <TableHead className="h-11 px-6 text-right text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.data.map((payout) => (
                    <TableRow
                      key={payout.id}
                      className="border-border transition-colors hover:bg-emerald-50/40"
                    >
                      <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                        {formatUserDateTime(payout.createdAt, tz, "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <Badge variant="outline" className="font-medium capitalize">
                          {payout.kind === "REFERRAL" ? "Referral" : "Publisher"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <p className="font-medium text-foreground">{payout.publisher.name}</p>
                        <p className="text-xs text-muted-foreground">{payout.publisher.email}</p>
                        {payout.publisher.publisherProfile?.website && (
                          <p className="text-xs text-muted-foreground">
                            {payout.publisher.publisherProfile.website}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <span className="font-semibold tabular-nums text-emerald-600">
                          {formatCurrency(Number(payout.amount))}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                        {formatPayoutMethod(payout.method)}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate px-4 py-4 text-xs text-muted-foreground">
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
                      <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                        {payout.processedAt
                          ? formatUserDateTime(payout.processedAt, tz, "MMM d, yyyy HH:mm")
                          : "—"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
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
