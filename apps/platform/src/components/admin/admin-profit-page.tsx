"use client";

import { Suspense } from "react";
import { Banknote, HandCoins, Landmark, PiggyBank, Wallet } from "lucide-react";
import { formatCurrency } from "@/components/admin/admin-ui";
import { UsersTablePagination } from "@/components/admin/users-table-pagination";
import {
  AffsenseStatCard,
  type AffsenseStatAccent,
} from "@/components/dashboard/affsense-stat-card";
import { ExportCsvButton } from "@/components/reports/export-csv-button";
import {
  formatProfitDateDisplay,
  formatProfitPeriodLabel,
  type ProfitGroupBy,
} from "@/services/admin-profit.service";
import {
  formatPartnerDate,
  formatPartnerPeriodMonthLabel,
  type InvoiceProfitRow,
  type InvoiceProfitTotals,
  type PartnerInvoiceRecord,
  type PartnerInvoiceStatusValue,
  type PartnerInvoiceSummary,
} from "@/lib/partner-invoice";
import { AdminPartnerInvoicePayDialog } from "@/components/admin/admin-partner-invoice-pay-dialog";
import { cn } from "@/lib/utils";

function moneyClass(value: number) {
  return value >= 0 ? "text-[var(--theme-success)]" : "text-destructive";
}

function invoiceStatusLabel(status: PartnerInvoiceStatusValue) {
  switch (status) {
    case "UNPAID":
      return "Unpaid";
    case "PAID":
      return "Paid";
    case "NOTHING_DUE":
      return "Nothing due";
  }
}

function invoiceStatusClass(status: PartnerInvoiceStatusValue) {
  switch (status) {
    case "UNPAID":
      return "bg-amber-50 text-amber-800";
    case "PAID":
      return "bg-emerald-50 text-emerald-800";
    case "NOTHING_DUE":
      return "bg-muted text-muted-foreground";
  }
}

export function AdminPartnerInvoiceSummary({ summary }: { summary: PartnerInvoiceSummary }) {
  const cards: Array<{
    title: string;
    value: number;
    description: string;
    accent: AffsenseStatAccent;
    icon: typeof Wallet;
  }> = [
    {
      title: "Partner unpaid",
      value: summary.unpaid,
      description: `${summary.unpaidCount} unpaid ${summary.unpaidCount === 1 ? "invoice" : "invoices"}`,
      accent: "amber",
      icon: Wallet,
    },
    {
      title: "Partner paid",
      value: summary.paid,
      description: `${summary.paidCount} paid ${summary.paidCount === 1 ? "invoice" : "invoices"}`,
      accent: "coral",
      icon: HandCoins,
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {cards.map((card) => (
        <AffsenseStatCard
          key={card.title}
          label={card.title}
          value={formatCurrency(card.value)}
          icon={card.icon}
          accent={card.accent}
          footer={{ sub: card.description }}
        />
      ))}
    </div>
  );
}

export function AdminPartnerInvoiceTable({
  invoices,
  canPay,
}: {
  invoices: PartnerInvoiceRecord[];
  canPay: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">Partner invoices</h2>
        <p className="text-sm text-muted-foreground">
          One invoice per month for the 20% partner share, created on the 1st for the month that
          just ended. Newest first.
        </p>
      </div>
      {invoices.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">
          No partner invoices yet. The first one is created on the 1st of next month.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="bg-muted/90 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 pl-5">Invoice</th>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3">Platform profit</th>
                <th className="px-4 py-3">Partner (20%)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3 pr-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-border align-top hover:bg-muted/60">
                  <td className="px-4 py-3 pl-5 font-mono text-xs text-foreground">{invoice.number}</td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {formatPartnerPeriodMonthLabel(invoice.periodMonth)}
                  </td>
                  <td className="px-4 py-3 text-foreground">{formatCurrency(invoice.received)}</td>
                  <td className="px-4 py-3 text-foreground">
                    {formatCurrency(invoice.affiliateSent + invoice.referralSent)}
                  </td>
                  <td className={cn("px-4 py-3", moneyClass(invoice.platformProfit))}>
                    {formatCurrency(invoice.platformProfit)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {formatCurrency(invoice.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        invoiceStatusClass(invoice.status),
                      )}
                    >
                      {invoiceStatusLabel(invoice.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{formatPartnerDate(invoice.issuedAt)}</td>
                  <td className="max-w-[240px] px-4 py-3 text-xs text-muted-foreground">
                    {invoice.status === "PAID" ? (
                      <div className="space-y-0.5">
                        <p className="text-sm text-foreground">
                          {formatPartnerDate(invoice.paidAt)}
                          {invoice.paymentMethod ? ` · ${invoice.paymentMethod}` : ""}
                        </p>
                        {invoice.paymentReference ? (
                          <p className="font-mono">Ref: {invoice.paymentReference}</p>
                        ) : null}
                        {invoice.paidNote ? <p className="truncate" title={invoice.paidNote}>{invoice.paidNote}</p> : null}
                        {invoice.paidByName ? <p>By {invoice.paidByName}</p> : null}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 pr-5 text-right">
                    {invoice.status === "UNPAID" && canPay ? (
                      <AdminPartnerInvoicePayDialog invoice={invoice} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminProfitSummaryCards({
  summary,
}: {
  summary: InvoiceProfitTotals;
}) {
  const cards: Array<{
    title: string;
    value: number;
    description: string;
    detail: string;
    accent: AffsenseStatAccent;
    icon: typeof Landmark;
  }> = [
    {
      title: "Platform profit",
      value: summary.platformProfit,
      description: "Advertiser invoices received − affiliate invoices − referral payouts",
      detail: `${formatCurrency(summary.received)} − ${formatCurrency(summary.affiliateSent)} − ${formatCurrency(summary.referralSent)}`,
      accent: "emerald",
      icon: Landmark,
    },
    {
      title: "Admin profit",
      value: summary.adminProfit,
      description: "Platform profit × 80%",
      detail: `${formatCurrency(summary.platformProfit)} × 80%`,
      accent: "coral",
      icon: Banknote,
    },
    {
      title: "Partner profit",
      value: summary.partnerProfit,
      description: "Remaining share · Platform profit × 20%",
      detail: `${formatCurrency(summary.platformProfit)} × 20%`,
      accent: "navy",
      icon: PiggyBank,
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {cards.map((card) => (
        <AffsenseStatCard
          key={card.title}
          label={card.title}
          value={formatCurrency(card.value)}
          icon={card.icon}
          accent={card.accent}
          valueClassName={moneyClass(card.value)}
          footer={{ sub: `${card.description} · ${card.detail}` }}
        />
      ))}
    </div>
  );
}

export function AdminProfitReportTable({
  allRows,
  pageRows,
  groupBy,
  fromStr,
  toStr,
  page,
  totalPages,
  total,
}: {
  allRows: InvoiceProfitRow[];
  pageRows: InvoiceProfitRow[];
  groupBy: ProfitGroupBy;
  fromStr: string;
  toStr: string;
  page: number;
  totalPages: number;
  total: number;
}) {
  const headers = [
    "Period",
    "Advertiser invoices received",
    "Affiliate invoices sent",
    "Referral sent",
    "Platform profit",
    "Admin profit (80%)",
    "Partner profit (20%)",
  ];

  const fromLabel = formatProfitDateDisplay(fromStr);
  const toLabel = formatProfitDateDisplay(toStr);

  const csvRows = allRows.map((row) => [
    formatProfitPeriodLabel(row.period, groupBy),
    row.received,
    row.affiliateSent,
    row.referralSent,
    row.platformProfit,
    row.adminProfit,
    row.partnerProfit,
  ]);

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Profit report</h2>
          <p className="text-sm text-muted-foreground">
            Breakdown for {fromLabel} → {toLabel}
          </p>
        </div>
        <ExportCsvButton
          filename={`admin-profit-${fromStr}-${toStr}.csv`}
          headers={headers}
          rows={csvRows}
        />
      </div>

      {total === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">No profit data for this range.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/90 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  {headers.map((header) => (
                    <th key={header} className="px-4 py-3 first:pl-5 last:pr-5">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.period} className="border-t border-border hover:bg-muted/60">
                    <td className="px-4 py-3 pl-5 font-medium text-foreground">
                      {formatProfitPeriodLabel(row.period, groupBy)}
                    </td>
                    <td className="px-4 py-3 text-foreground">{formatCurrency(row.received)}</td>
                    <td className="px-4 py-3 text-foreground">{formatCurrency(row.affiliateSent)}</td>
                    <td className="px-4 py-3 text-foreground">{formatCurrency(row.referralSent)}</td>
                    <td className={cn("px-4 py-3 font-semibold", moneyClass(row.platformProfit))}>
                      {formatCurrency(row.platformProfit)}
                    </td>
                    <td className={cn("px-4 py-3 font-semibold", moneyClass(row.adminProfit))}>
                      {formatCurrency(row.adminProfit)}
                    </td>
                    <td className={cn("px-4 py-3 pr-5 font-semibold", moneyClass(row.partnerProfit))}>
                      {formatCurrency(row.partnerProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Suspense fallback={null}>
            <UsersTablePagination page={page} totalPages={totalPages} total={total} />
          </Suspense>
        </>
      )}
    </div>
  );
}
