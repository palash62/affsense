"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AffiliateInvoiceStatusBadge, formatCurrency } from "@/components/admin/admin-ui";
import { AffiliateInvoiceDownloadButton } from "@/components/invoices/affiliate-invoice-download-button";
import { PageHero } from "@/components/admin/page-hero";
import { Button } from "@/components/ui/button";
import { readApiErrorMessage } from "@/lib/errors";
import { formatPayoutMethodLabel } from "@/lib/payout-payment-details";
import type { SerializedAdvertiserCpaInvoice } from "@/services/advertiser-cpa-invoice.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AdminAdvertiserCpaInvoicesPanel() {
  const [items, setItems] = useState<SerializedAdvertiserCpaInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/admin/advertiser-cpa-invoices?page=1&limit=50");
    const body = await res.json().catch(() => ({}));
    setItems(body.data?.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setBusyId("generate");
    try {
      const res = await fetch("/api/v1/admin/advertiser-cpa-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: "UTC" }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(readApiErrorMessage(body, "Generate failed", res.status));
      }
      toast.success(`Created ${body.data?.created ?? 0} invoice(s)`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generate failed");
    } finally {
      setBusyId(null);
    }
  }

  async function patchAction(invoiceId: string, action: "approve" | "reject") {
    setBusyId(invoiceId);
    try {
      const res = await fetch("/api/v1/admin/advertiser-cpa-invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, action }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          readApiErrorMessage(
            body,
            action === "approve" ? "Approve failed" : "Reject failed",
            res.status,
          ),
        );
      }
      toast.success(action === "approve" ? "Invoice marked paid" : "Payment rejected");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHero
          title="Advertiser CPA Invoices"
          description="AR invoices for offer owners. Advertisers submit offline payment proof; approve to mark paid."
        />
        <Button type="button" disabled={busyId === "generate"} onClick={() => void generate()}>
          {busyId === "generate" ? "Generating…" : "Generate invoices"}
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            No advertiser CPA invoices yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
                <TableHead className="px-4">Invoice</TableHead>
                <TableHead className="px-4">Advertiser</TableHead>
                <TableHead className="px-4 text-right">Amount</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4">Submitted</TableHead>
                <TableHead className="px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="px-4 font-mono text-xs">{invoice.number}</TableCell>
                  <TableCell className="px-4 text-sm">{invoice.advertiserName}</TableCell>
                  <TableCell className="px-4 text-right tabular-nums">
                    {formatCurrency(Number(invoice.total))}
                  </TableCell>
                  <TableCell className="px-4">
                    <AffiliateInvoiceStatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell className="px-4 text-xs text-muted-foreground">
                    {invoice.paymentMethod || invoice.paymentReference ? (
                      <span>
                        {invoice.paymentMethod
                          ? formatPayoutMethodLabel(invoice.paymentMethod)
                          : "—"}
                        {invoice.paymentReference ? ` · ${invoice.paymentReference}` : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <AffiliateInvoiceDownloadButton
                        href={`/admin/cpa-offers/advertiser-invoices/${invoice.id}/print`}
                      />
                      {invoice.status === "PENDING_APPROVAL" ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === invoice.id}
                            onClick={() => void patchAction(invoice.id, "reject")}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            disabled={busyId === invoice.id}
                            onClick={() => void patchAction(invoice.id, "approve")}
                          >
                            Approve
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
