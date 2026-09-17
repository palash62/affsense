"use client";

import { Suspense } from "react";
import { Banknote, HandCoins, Landmark, PiggyBank, Scale, Wallet } from "lucide-react";
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
  type AdminProfitPageData,
  type ProfitGroupBy,
} from "@/services/admin-profit.service";
import {
  formatPartnerPaidDate,
  formatPartnerPeriodMonthLabel,
  type PartnerPaymentRecord,
  type PartnerSettlementRow,
  type PartnerSettlementStatus,
  type PartnerSettlementSummary,
} from "@/services/partner-payment.service";
import { cn } from "@/lib/utils";

function moneyClass(value: number) {
  return value >= 0 ? "text-[var(--theme-success)]" : "text-destructive";
}

function settlementStatusLabel(status: PartnerSettlementStatus) {
  switch (status) {
    case "unpaid":
      return "Unpaid";
    case "partial":
      return "Partial";
    case "settled":
      return "Settled";
    case "overpaid":
      return "Overpaid";
  }
}

function settlementStatusClass(status: PartnerSettlementStatus) {
  switch (status) {
    case "unpaid":
      return "bg-amber-50 text-amber-800";
    case "partial":
      return "bg-sky-50 text-sky-800";
    case "settled":
      return "bg-emerald-50 text-emerald-800";
    case "overpaid":
      return "bg-violet-50 text-violet-800";
  }
}

export function AdminPartnerSettlementSummary({
  summary,
}: {
  summary: PartnerSettlementSummary;
}) {
  const cards: Array<{
    title: string;
    value: number;
    description: string;
    accent: AffsenseStatAccent;
    icon: typeof Wallet;
  }> = [
    {
      title: "Partner owed",
      value: summary.owed,
      description: "20% partner profit for months in range",
      accent: "navy",
      icon: Scale,
    },
    {
      title: "Partner paid",
      value: summary.paid,
      description: "Manual payments recorded",
      accent: "coral",
      icon: HandCoins,
    },
    {
      title: "Partner remaining",
      value: summary.remaining,
      description: "Owed − paid (negative = overpaid)",
      accent: "amber",
      icon: Wallet,
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
          footer={{ sub: card.description }}
        />
      ))}
    </div>
  );
}

export function AdminPartnerSettlementTable({ rows }: { rows: PartnerSettlementRow[] }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">Partner settlement</h2>
        <p className="text-sm text-muted-foreground">Monthly owed vs paid for the selected range</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">No months in this range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/90 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 pl-5">Month</th>
                <th className="px-4 py-3">Owed</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Remaining</th>
                <th className="px-4 py-3 pr-5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.periodMonth} className="border-t border-border hover:bg-muted/60">
                  <td className="px-4 py-3 pl-5 font-medium text-foreground">
                    {formatPartnerPeriodMonthLabel(row.periodMonth)}
                  </td>
                  <td className={cn("px-4 py-3", moneyClass(row.owed))}>
                    {formatCurrency(row.owed)}
                  </td>
                  <td className="px-4 py-3 text-foreground">{formatCurrency(row.paid)}</td>
                  <td className={cn("px-4 py-3 font-semibold", moneyClass(row.remaining))}>
                    {formatCurrency(row.remaining)}
                  </td>
                  <td className="px-4 py-3 pr-5">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        settlementStatusClass(row.status),
                      )}
                    >
                      {settlementStatusLabel(row.status)}
                    </span>
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

export function AdminPartnerPaymentHistory({ payments }: { payments: PartnerPaymentRecord[] }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">Payment history</h2>
        <p className="text-sm text-muted-foreground">Manual partner payments in this range (newest first)</p>
      </div>
      {payments.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">No partner payments recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/90 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 pl-5">Month</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Paid date</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3 pr-5">Recorded by</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-t border-border hover:bg-muted/60">
                  <td className="px-4 py-3 pl-5 font-medium text-foreground">
                    {formatPartnerPeriodMonthLabel(payment.periodMonth)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {formatPartnerPaidDate(payment.paidAt)}
                  </td>
                  <td className="px-4 py-3 text-foreground">{payment.method || "—"}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground" title={payment.note ?? ""}>
                    {payment.note || "—"}
                  </td>
                  <td className="px-4 py-3 pr-5 text-foreground">
                    {payment.createdByName || "—"}
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
  summary: AdminProfitPageData["summary"];
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
      description: "Advertiser payments − publisher payouts − referral pay",
      detail: `${formatCurrency(summary.advertiserPayment)} − ${formatCurrency(summary.publisherPayout)} − ${formatCurrency(summary.referralPay)}`,
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
  allRows: AdminProfitPageData["rows"];
  pageRows: AdminProfitPageData["rows"];
  groupBy: ProfitGroupBy;
  fromStr: string;
  toStr: string;
  page: number;
  totalPages: number;
  total: number;
}) {
  const headers = [
    "Period",
    "Advertiser payments",
    "Publisher payouts",
    "Referral pay",
    "Platform profit",
    "Admin profit (80%)",
    "Partner profit (20%)",
  ];

  const fromLabel = formatProfitDateDisplay(fromStr);
  const toLabel = formatProfitDateDisplay(toStr);

  const csvRows = allRows.map((row) => [
    formatProfitPeriodLabel(row.period, groupBy),
    row.advertiserPayment,
    row.publisherPayout,
    row.referralPay,
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
                    <td className="px-4 py-3 text-foreground">{formatCurrency(row.advertiserPayment)}</td>
                    <td className="px-4 py-3 text-foreground">{formatCurrency(row.publisherPayout)}</td>
                    <td className="px-4 py-3 text-foreground">{formatCurrency(row.referralPay)}</td>
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
