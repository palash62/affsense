import { Suspense } from "react";
import type { AffiliateInvoiceStatus } from "@prisma/client";
import { AlertTriangle, DollarSign, Receipt, Wallet } from "lucide-react";
import {
  getAffiliateInvoiceStats,
  listAffiliateInvoicesForAdmin,
  listInvoicePublisherOptions,
} from "@/services/affiliate-invoice.service";
import { loadAffiliateInvoicingConfig } from "@/services/affiliate-invoicing-settings.service";
import { getSession } from "@/lib/session";
import { formatUserDateTime } from "@/lib/user-timezone";
import { formatInvoicePeriod } from "@/lib/affiliate-invoice-period";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { AffiliateInvoiceStatusBadge, formatCurrency } from "@/components/admin/admin-ui";
import { AdminInvoicesFilters } from "@/components/admin/admin-invoices-filters";
import { AdminInvoicePayDialog } from "@/components/admin/admin-invoice-pay-dialog";
import { AdminGenerateInvoicesButton } from "@/components/admin/admin-generate-invoices-button";
import { UsersTablePagination } from "@/components/admin/users-table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["UNPAID", "PAID", "CANCELLED", "OVERDUE"]);

interface PageProps {
  searchParams: Promise<{
    publisher?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function AdminInvoicesPage({ searchParams }: PageProps) {
  const session = await getSession();
  const tz = session?.user?.timezone;
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const [invoices, publishers, stats, config] = await Promise.all([
    listAffiliateInvoicesForAdmin({
      publisherId: params.publisher,
      status:
        params.status && STATUSES.has(params.status)
          ? (params.status as AffiliateInvoiceStatus | "OVERDUE")
          : undefined,
      from: params.from,
      to: params.to,
      page,
      limit: 20,
    }),
    listInvoicePublisherOptions(),
    getAffiliateInvoiceStats(),
    loadAffiliateInvoicingConfig(),
  ]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <GradientStatCard
          variant="revenue"
          label="Unpaid invoices"
          value={formatCurrency(stats.unpaidAmount)}
          icon={DollarSign}
        />
        <NeutralStatCard
          label="Overdue"
          value={stats.overdueCount}
          icon={AlertTriangle}
          accent={stats.overdueCount > 0 ? "red" : "orange"}
        />
        <NeutralStatCard
          label="Paid this month"
          value={formatCurrency(stats.paidThisMonthAmount)}
          icon={Wallet}
          accent="purple"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Weekly Monday-to-Sunday earnings, invoiced on Net-{config.netTermDays} terms once an
          affiliate reaches {formatCurrency(config.minimumAmount)}.
          {config.enabled ? "" : " Invoicing is currently disabled in settings."}
        </p>
        <AdminGenerateInvoicesButton />
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]">
        <Suspense fallback={null}>
          <AdminInvoicesFilters publishers={publishers} />
        </Suspense>

        {invoices.invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center border-t border-dashed border-border px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--theme-primary-soft)]">
              <Receipt className="h-6 w-6 text-[var(--theme-primary)]" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">No invoices found</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Generate invoices for the last completed week, or adjust the filters above.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent bg-muted/60">
                    <TableHead className="h-11 px-6 text-muted-foreground">Invoice</TableHead>
                    <TableHead className="h-11 px-4 text-muted-foreground">Affiliate</TableHead>
                    <TableHead className="h-11 px-4 text-muted-foreground">Period</TableHead>
                    <TableHead className="h-11 px-4 text-muted-foreground">Issued</TableHead>
                    <TableHead className="h-11 px-4 text-muted-foreground">Due</TableHead>
                    <TableHead className="h-11 px-4 text-right text-muted-foreground">
                      Total
                    </TableHead>
                    <TableHead className="h-11 px-4 text-muted-foreground">Status</TableHead>
                    <TableHead className="h-11 px-6 text-right text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.invoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className="border-border transition-colors hover:bg-muted/40"
                    >
                      <TableCell className="px-6 py-4 font-mono text-xs font-medium text-foreground">
                        {invoice.number}
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <p className="font-medium text-foreground">{invoice.publisherName}</p>
                        <p className="text-xs text-muted-foreground">{invoice.publisherEmail}</p>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                        {formatInvoicePeriod(
                          invoice.periodStart,
                          invoice.periodEnd,
                          config.timezone,
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                        {formatUserDateTime(invoice.issuedAt, tz, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                        {formatUserDateTime(invoice.dueAt, tz, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <span className="font-semibold tabular-nums text-emerald-600">
                          {formatCurrency(invoice.total)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <AffiliateInvoiceStatusBadge
                          status={invoice.status}
                          overdue={invoice.overdue}
                        />
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <AdminInvoicePayDialog invoice={invoice} timezone={tz ?? undefined} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Suspense fallback={null}>
              <UsersTablePagination
                page={invoices.page}
                totalPages={invoices.totalPages}
                total={invoices.total}
              />
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
}
