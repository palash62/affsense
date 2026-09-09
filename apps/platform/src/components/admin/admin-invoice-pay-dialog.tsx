"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AffiliateInvoiceStatusBadge, formatCurrency } from "@/components/admin/admin-ui";
import { AffiliateInvoiceDownloadButton } from "@/components/invoices/affiliate-invoice-download-button";
import { formatInvoicePeriod } from "@/lib/affiliate-invoice-period";
import { formatPayoutMethodLabel } from "@/lib/payout-payment-details";
import { formatUserDateTime } from "@/lib/user-timezone";
import type { SerializedAffiliateInvoice } from "@/services/affiliate-invoice.service";

const METHOD_OPTIONS = ["WISE", "BANK_TRANSFER", "STRIPE_CONNECT"] as const;

export function AdminInvoicePayDialog({
  invoice,
  timezone,
}: {
  invoice: SerializedAffiliateInvoice;
  timezone?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(invoice.status);
  const [method, setMethod] = useState<string>(invoice.paymentMethod ?? "WISE");
  const [reference, setReference] = useState(invoice.paymentReference ?? "");
  const [note, setNote] = useState(invoice.adminNote ?? "");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  const canAct = status === "UNPAID";

  async function submit(action: "pay" | "cancel") {
    if (action === "cancel" && !cancelReason.trim()) {
      setError("Cancellation reason is required");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch(`/api/v1/admin/affiliate-invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "pay"
          ? { action, method, reference: reference.trim(), note: note.trim() }
          : { action, reason: cancelReason.trim() },
      ),
    });
    const data = await res.json().catch(() => ({}));

    setLoading(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to update the invoice");
      return;
    }

    setStatus(action === "pay" ? "PAID" : "CANCELLED");
    setShowCancel(false);
    router.refresh();
  }

  return (
    <div className="inline-flex items-center justify-end gap-2">
      <AffiliateInvoiceDownloadButton href={`/admin/invoices/${invoice.id}/print`} />
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="h-8 gap-1">
            {canAct ? "Pay" : "View"}
          </Button>
        }
      >
        <Eye className="h-3.5 w-3.5" />
        {canAct ? "Pay" : "View"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
            <DialogTitle>Invoice {invoice.number}</DialogTitle>
            <AffiliateInvoiceDownloadButton
              href={`/admin/invoices/${invoice.id}/print`}
              variant="ghost"
            />
          </div>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-muted/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(invoice.total)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {invoice.publisherName} · {invoice.publisherEmail}
                </p>
              </div>
              <AffiliateInvoiceStatusBadge status={status} overdue={invoice.overdue} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">Earning period</p>
                <p className="text-sm font-medium text-foreground">
                  {formatInvoicePeriod(invoice.periodStart, invoice.periodEnd, timezone ?? "UTC")}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">Due</p>
                <p className="text-sm font-medium text-foreground">
                  {formatUserDateTime(invoice.dueAt, timezone, "MMM d, yyyy")}
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">Breakdown</p>
            <div className="divide-y divide-border rounded-lg border border-border">
              {invoice.lines.map((line) => (
                <div key={line.id} className="flex items-center justify-between px-3 py-2">
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
          </div>

          {status === "PAID" ? (
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <p className="text-muted-foreground">
                Paid {formatUserDateTime(invoice.paidAt, timezone, "MMM d, yyyy HH:mm")}
                {invoice.paymentMethod
                  ? ` via ${formatPayoutMethodLabel(invoice.paymentMethod)}`
                  : ""}
              </p>
              {invoice.paymentReference ? (
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  Ref: {invoice.paymentReference}
                </p>
              ) : null}
            </div>
          ) : null}

          {status === "CANCELLED" && invoice.cancelReason ? (
            <p className="text-sm text-muted-foreground">
              Cancelled: {invoice.cancelReason}
            </p>
          ) : null}

          {canAct ? (
            <div className="space-y-4 border-t border-border pt-4">
              {showCancel ? (
                <div className="space-y-2">
                  <Label>Cancellation reason</Label>
                  <Input
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Why is this invoice being cancelled?"
                  />
                  <p className="text-xs text-muted-foreground">
                    The earnings return to the pool and will be invoiced again on the next run.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Payment method</Label>
                      <Select
                        value={method}
                        onValueChange={(value) => value && setMethod(value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {METHOD_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {formatPayoutMethodLabel(option)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Payment reference</Label>
                      <Input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Transfer ID"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Internal note</Label>
                    <Input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </>
              )}

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="flex flex-wrap justify-end gap-2">
                {showCancel ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading}
                      onClick={() => {
                        setShowCancel(false);
                        setError(null);
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={loading}
                      onClick={() => void submit("cancel")}
                      className="gap-1.5"
                    >
                      <Ban className="h-4 w-4" />
                      {loading ? "Cancelling…" : "Confirm cancel"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading}
                      onClick={() => {
                        setShowCancel(true);
                        setError(null);
                      }}
                      className="gap-1.5"
                    >
                      <Ban className="h-4 w-4" />
                      Cancel invoice
                    </Button>
                    <Button
                      type="button"
                      disabled={loading}
                      onClick={() => void submit("pay")}
                      className="gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {loading ? "Recording…" : "Mark as paid"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
    </div>
  );
}
