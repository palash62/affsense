"use client";

import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Receipt } from "lucide-react";
import { AffiliateInvoiceStatusBadge, formatCurrency } from "@/components/admin/admin-ui";
import { RoleHero } from "@/components/layout/role-hero";
import { formatInvoicePeriod } from "@/lib/affiliate-invoice-period";
import { formatUserDateTime } from "@/lib/user-timezone";
import type { SerializedAdvertiserCpaInvoice } from "@/services/advertiser-cpa-invoice.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AdvertiserCpaInvoicesList({ timezone = "UTC" }: { timezone?: string }) {
  const [items, setItems] = useState<SerializedAdvertiserCpaInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch("/api/v1/advertiser/invoices?page=1&limit=50");
      const body = await res.json().catch(() => ({}));
      setItems(body.data?.items ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <RoleHero
        eyebrow="Advertiser Portal"
        title="CPA Invoices"
        description="Amounts owed for conversions on your CPA offers. Pay offline — admin marks invoices paid."
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">Loading invoices…</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--theme-primary-soft)]">
              <Receipt className="h-6 w-6 text-[var(--theme-primary)]" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">No invoices yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Invoices are raised weekly for conversions on your offers.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent bg-muted/60">
                  <TableHead className="h-11 px-6 text-muted-foreground">Invoice</TableHead>
                  <TableHead className="h-11 px-4 text-muted-foreground">Period</TableHead>
                  <TableHead className="h-11 px-4 text-muted-foreground">Issued</TableHead>
                  <TableHead className="h-11 px-4 text-muted-foreground">Due</TableHead>
                  <TableHead className="h-11 px-4 text-right text-muted-foreground">Amount</TableHead>
                  <TableHead className="h-11 px-4 text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((invoice) => {
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
                          <span className="flex items-center gap-2 font-mono text-xs font-medium">
                            {open ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            {invoice.number}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                          {formatInvoicePeriod(
                            invoice.periodStart,
                            invoice.periodEnd,
                            timezone,
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                          {formatUserDateTime(invoice.issuedAt, timezone, "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                          {formatUserDateTime(invoice.dueAt, timezone, "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-right font-semibold tabular-nums text-foreground">
                          {formatCurrency(Number(invoice.total))}
                        </TableCell>
                        <TableCell className="px-4 py-4">
                          <AffiliateInvoiceStatusBadge status={invoice.status} />
                        </TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow className="border-border bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={6} className="px-6 py-4">
                            <ul className="space-y-2 text-sm">
                              {invoice.lines.map((line) => (
                                <li
                                  key={line.id}
                                  className="flex items-center justify-between gap-4"
                                >
                                  <span className="text-muted-foreground">
                                    {line.description} ({line.conversionCount} conv.)
                                  </span>
                                  <span className="font-medium tabular-nums">
                                    {formatCurrency(Number(line.amount))}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
