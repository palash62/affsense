"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Receipt } from "lucide-react";
import { AffiliateInvoiceStatusBadge, formatCurrency } from "@/components/admin/admin-ui";
import { AffiliateInvoiceDownloadButton } from "@/components/invoices/affiliate-invoice-download-button";
import { formatInvoicePeriod } from "@/lib/affiliate-invoice-period";
import { formatUserDateTime } from "@/lib/user-timezone";
import type { SerializedAffiliateInvoice } from "@/services/affiliate-invoice.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function PublisherInvoicesList({
  invoices,
  timezone,
  periodTimezone,
}: {
  invoices: SerializedAffiliateInvoice[];
  timezone?: string;
  periodTimezone: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--theme-primary-soft)]">
          <Receipt className="h-6 w-6 text-[var(--theme-primary)]" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-foreground">No invoices yet</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Your first invoice is raised on the Monday after your earnings reach the minimum.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent bg-muted/60">
            <TableHead className="h-11 px-6 text-muted-foreground">Invoice</TableHead>
            <TableHead className="h-11 px-4 text-muted-foreground">Earning period</TableHead>
            <TableHead className="h-11 px-4 text-muted-foreground">Issued</TableHead>
            <TableHead className="h-11 px-4 text-muted-foreground">Due</TableHead>
            <TableHead className="h-11 px-4 text-right text-muted-foreground">Amount</TableHead>
            <TableHead className="h-11 px-4 text-muted-foreground">Status</TableHead>
            <TableHead className="h-11 px-6 text-right text-muted-foreground">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => {
            const open = expanded === invoice.id;
            return (
              <Fragment key={invoice.id}>
                <TableRow
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpanded(open ? null : invoice.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpanded(open ? null : invoice.id);
                    }
                  }}
                  className="cursor-pointer border-border transition-colors hover:bg-muted/40"
                >
                  <TableCell className="px-6 py-4">
                    <span className="flex items-center gap-2 font-mono text-xs font-medium text-foreground">
                      {open ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      {invoice.number}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                    {formatInvoicePeriod(invoice.periodStart, invoice.periodEnd, periodTimezone)}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                    {formatUserDateTime(invoice.issuedAt, timezone, "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                    {formatUserDateTime(invoice.dueAt, timezone, "MMM d, yyyy")}
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
                    <AffiliateInvoiceDownloadButton
                      href={`/publisher/invoices/${invoice.id}/print`}
                      stopPropagation
                    />
                  </TableCell>
                </TableRow>

                {open ? (
                  <TableRow className="border-border bg-muted/30">
                    <TableCell colSpan={7} className="px-6 py-4">
                      <p className="mb-2 text-sm font-semibold text-foreground">Breakdown</p>
                      <div className="divide-y divide-border rounded-lg border border-border bg-card">
                        {invoice.lines.map((line) => (
                          <div
                            key={line.id}
                            className="flex items-center justify-between px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium text-foreground">{line.source}</p>
                              <p className="text-xs text-muted-foreground">
                                {line.entryCount} {line.entryCount === 1 ? "entry" : "entries"}
                              </p>
                            </div>
                            <span className="text-sm font-semibold tabular-nums text-foreground">
                              {formatCurrency(line.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {invoice.status === "PAID" ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                          Paid on{" "}
                          {formatUserDateTime(invoice.paidAt, timezone, "MMM d, yyyy")}
                          {invoice.paymentReference
                            ? ` · reference ${invoice.paymentReference}`
                            : ""}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">
                          Payment is due by{" "}
                          {formatUserDateTime(invoice.dueAt, timezone, "MMM d, yyyy")}.
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
