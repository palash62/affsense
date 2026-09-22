"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatCurrency } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { readApiErrorMessage } from "@/lib/errors";
import type { SerializedAdvertiserCpaInvoice } from "@/services/advertiser-cpa-invoice.service";

type PayMethod = "WISE" | "BANK_TRANSFER" | "STRIPE_CONNECT" | "PAYPAL";

type PayInstructions = {
  bankDetails: string | null;
  wise: string | null;
  paypal: string | null;
  stripe: string | null;
};

export function AdvertiserCpaInvoicePayDialog({
  invoice,
  open,
  onOpenChange,
  onSubmitted,
}: {
  invoice: SerializedAdvertiserCpaInvoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (invoice: SerializedAdvertiserCpaInvoice) => void;
}) {
  const [instructions, setInstructions] = useState<PayInstructions | null>(null);
  const [method, setMethod] = useState<PayMethod>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReference("");
    setNote("");
    void (async () => {
      const res = await fetch("/api/v1/advertiser/invoices/pay-instructions");
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setInstructions(body.data as PayInstructions);
      }
    })();
  }, [open]);

  const availableMethods = useMemo(() => {
    const opts: { value: PayMethod; label: string; detail: string | null }[] = [
      { value: "BANK_TRANSFER", label: "Bank transfer", detail: instructions?.bankDetails ?? null },
      { value: "WISE", label: "Wise", detail: instructions?.wise ?? null },
      { value: "PAYPAL", label: "PayPal", detail: instructions?.paypal ?? null },
      { value: "STRIPE_CONNECT", label: "Stripe", detail: instructions?.stripe ?? null },
    ];
    const withDetails = opts.filter((o) => o.detail);
    return withDetails.length > 0 ? withDetails : opts;
  }, [instructions]);

  useEffect(() => {
    if (availableMethods.length === 0) return;
    if (!availableMethods.some((m) => m.value === method)) {
      setMethod(availableMethods[0].value);
    }
  }, [availableMethods, method]);

  const selectedDetail =
    availableMethods.find((m) => m.value === method)?.detail ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/advertiser/invoices/${invoice.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          reference,
          note: note.trim() || null,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(readApiErrorMessage(body, "Submit failed", res.status));
      }
      toast.success("Payment submitted — awaiting admin approval");
      onSubmitted(body.data as SerializedAdvertiserCpaInvoice);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pay invoice {invoice?.number}</DialogTitle>
          <DialogDescription>
            Pay{" "}
            <span className="font-semibold text-foreground">
              {invoice ? formatCurrency(Number(invoice.total)) : ""}
            </span>{" "}
            manually using the details below, then submit your payment reference for admin
            approval.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select
              value={method}
              onValueChange={(v) => v && setMethod(v as PayMethod)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableMethods.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedDetail ? (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pay to
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{selectedDetail}</p>
            </div>
          ) : (
            <p className="text-sm text-amber-700">
              Admin has not published receive details yet. You can still submit a reference
              after paying via your agreed channel.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="pay-reference">Transaction / reference ID</Label>
            <Input
              id="pay-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              required
              placeholder="e.g. Wise transfer ID or bank reference"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-note">Note (optional)</Label>
            <Textarea
              id="pay-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !reference.trim()}>
              {loading ? "Submitting…" : "Submit payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
