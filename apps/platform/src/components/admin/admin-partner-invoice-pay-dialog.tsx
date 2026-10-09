"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
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
import { formatCurrency } from "@/components/admin/admin-ui";
import { AdminProfitBreakdown } from "@/components/admin/admin-profit-breakdown";
import {
  formatPartnerPeriodMonthLabel,
  type PartnerInvoiceRecord,
} from "@/lib/partner-invoice";

export function AdminPartnerInvoicePayDialog({ invoice }: { invoice: PartnerInvoiceRecord }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [paidAt, setPaidAt] = useState(format(new Date(), "yyyy-MM-dd"));
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!method.trim()) {
      setError("Payment method is required");
      return;
    }

    setLoading(true);
    setError(null);
    const res = await fetch(`/api/v1/admin/partner-invoices/${invoice.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paidAt,
        method: method.trim(),
        reference: reference.trim() || null,
        note: note.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to mark the invoice paid");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="h-8 gap-1">
            Mark paid
          </Button>
        }
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Mark paid
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invoice {invoice.number}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="rounded-xl border border-border bg-muted/60 p-4">
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(invoice.amount)}</p>
            <p className="text-sm text-muted-foreground">
              Partner share (20%) for {formatPartnerPeriodMonthLabel(invoice.periodMonth)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatCurrency(invoice.received)} income −{" "}
              {formatCurrency(invoice.affiliateSent + invoice.referralSent + invoice.soloProviderCost)} costs ={" "}
              {formatCurrency(invoice.platformProfit)} platform profit
            </p>
          </div>
          {invoice.breakdown ? <AdminProfitBreakdown totals={invoice.breakdown} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`partner-paid-at-${invoice.id}`}>Paid date</Label>
              <Input
                id={`partner-paid-at-${invoice.id}`}
                type="date"
                required
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`partner-method-${invoice.id}`}>Payment method</Label>
              <Input
                id={`partner-method-${invoice.id}`}
                required
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                placeholder="Bank / Wise / Cash"
                maxLength={60}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`partner-reference-${invoice.id}`}>Payment reference</Label>
            <Input
              id={`partner-reference-${invoice.id}`}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transfer ID (optional)"
              maxLength={191}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`partner-note-${invoice.id}`}>Note</Label>
            <Input
              id={`partner-note-${invoice.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
              maxLength={2000}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={loading} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              {loading ? "Saving…" : "Mark as paid"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
