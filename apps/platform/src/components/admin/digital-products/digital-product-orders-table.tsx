"use client";

import { useState } from "react";
import { Ban, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { readApiErrorMessage } from "@/lib/errors";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DigitalProductOrderRow } from "@/services/digital-product.service";

function OrderTypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-muted-foreground">—</span>;
  const lower = type.toLowerCase();
  const cls = lower.includes("upsell")
    ? "bg-purple-100 text-purple-700"
    : lower.includes("downsell")
      ? "bg-orange-100 text-orange-700"
      : "bg-blue-100 text-blue-700";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", cls)}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const lower = status.toLowerCase();
  const cls =
    lower === "processed"
      ? "bg-emerald-100 text-emerald-700"
      : lower === "failed" || lower === "rejected"
        ? "bg-red-100 text-red-700"
        : lower === "duplicate"
          ? "bg-amber-100 text-amber-700"
          : "bg-slate-100 text-slate-600";

  const label =
    lower === "processed"
      ? "Approved"
      : lower === "failed"
        ? "Failed"
        : lower === "duplicate"
          ? "Duplicate"
          : lower === "ignored" || lower === "rejected"
            ? "Rejected"
            : status;

  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", cls)}>
      {label}
    </span>
  );
}

function PaymentBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const lower = status.toLowerCase();
  const cls =
    lower === "paid" || lower === "charged" || lower === "success"
      ? "bg-emerald-100 text-emerald-700"
      : lower.includes("refund")
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", cls)}>
      {status}
    </span>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUsd(n: number | null) {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

function RecurringBadge({ isRecurring }: { isRecurring?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
        isRecurring ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600",
      )}
    >
      {isRecurring ? "Recurring" : "Initial"}
    </span>
  );
}

function canReject(row: DigitalProductOrderRow) {
  return (
    row.webhookStatus === "PROCESSED" &&
    !(row.orderType ?? "").toLowerCase().includes("refund")
  );
}

export function DigitalProductOrdersTable({
  rows,
  showReason = false,
  onRejected,
}: {
  rows: DigitalProductOrderRow[];
  showReason?: boolean;
  /** Enables the Reject action; called after a successful rejection. */
  onRejected?: () => void;
}) {
  const [payloadRow, setPayloadRow] = useState<DigitalProductOrderRow | null>(null);
  const [rejectRow, setRejectRow] = useState<DigitalProductOrderRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  function openReject(row: DigitalProductOrderRow) {
    setRejectRow(row);
    setRejectReason("");
  }

  async function submitReject() {
    if (!rejectRow) return;
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      toast.error("Enter a reason (at least 3 characters).");
      return;
    }
    setRejecting(true);
    try {
      const res = await fetch(`/api/v1/admin/digital-products/orders/${rejectRow.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(readApiErrorMessage(body, "Failed to reject conversion.", res.status));
        return;
      }
      const reversed = Number(body?.data?.reversedAmount ?? 0);
      toast.success(
        reversed > 0
          ? `Conversion rejected. $${reversed.toFixed(2)} commission reversed.`
          : "Conversion rejected.",
      );
      setRejectRow(null);
      onRejected?.();
    } catch {
      toast.error("Failed to reject conversion. Check your connection and try again.");
    } finally {
      setRejecting(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-base font-semibold text-foreground">No orders found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Webhook events will appear here once ClickFunnels sends purchase data.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Order ID</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Date</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Customer</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Product</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Funnel</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Type</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-right text-xs">Amount</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Affiliate</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-right text-xs">Commission</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Source</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Sub ID 1</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Sub ID 2</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Sub ID 3</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Sub ID 4</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Status</TableHead>
              {showReason ? (
                <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Reason</TableHead>
              ) : null}
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Payment</TableHead>
              <TableHead className="px-4 py-3 text-xs">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="text-sm">
                <TableCell className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium text-foreground">
                  {row.orderId ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {formatDate(row.date)}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-foreground">
                      {row.customerName ?? "—"}
                    </span>
                    {row.customerEmail && (
                      <span className="text-[11px] text-muted-foreground">{row.customerEmail}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-w-[140px] truncate px-4 py-3 text-xs text-foreground">
                  {row.product ?? "—"}
                </TableCell>
                <TableCell className="max-w-[140px] truncate px-4 py-3 text-xs text-muted-foreground">
                  {row.funnel ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <OrderTypeBadge type={row.orderType} />
                    <RecurringBadge isRecurring={row.isRecurring} />
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-foreground">
                  {formatUsd(row.amount)}
                </TableCell>
                <TableCell className="px-4 py-3">
                  {row.affiliateName ? (
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-foreground">{row.affiliateName}</span>
                      {row.affiliateRef && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {row.affiliateRef.slice(0, 12)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-emerald-700">
                  {formatUsd(row.commission)}
                </TableCell>
                <TableCell className="max-w-[120px] truncate px-4 py-3 text-xs text-muted-foreground">
                  {row.source ?? "—"}
                </TableCell>
                <TableCell className="max-w-[100px] truncate px-4 py-3 text-xs text-muted-foreground">
                  {row.subId ?? "—"}
                </TableCell>
                <TableCell className="max-w-[100px] truncate px-4 py-3 text-xs text-muted-foreground">
                  {row.subId2 ?? "—"}
                </TableCell>
                <TableCell className="max-w-[100px] truncate px-4 py-3 text-xs text-muted-foreground">
                  {row.subId3 ?? "—"}
                </TableCell>
                <TableCell className="max-w-[100px] truncate px-4 py-3 text-xs text-muted-foreground">
                  {row.subId4 ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={row.webhookStatus} />
                </TableCell>
                {showReason ? (
                  <TableCell
                    className="max-w-[220px] truncate px-4 py-3 text-xs text-muted-foreground"
                    title={row.reason ?? undefined}
                  >
                    {row.reason ?? "—"}
                  </TableCell>
                ) : null}
                <TableCell className="whitespace-nowrap px-4 py-3">
                  <PaymentBadge status={row.paymentStatus} />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="View event details"
                      onClick={() => setPayloadRow(row)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {onRejected && canReject(row) ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-600 hover:bg-red-50 hover:text-red-700"
                        title="Reject conversion"
                        data-testid="reject-conversion"
                        onClick={() => openReject(row)}
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!payloadRow} onOpenChange={(open) => { if (!open) setPayloadRow(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order Detail — {payloadRow?.orderId ?? payloadRow?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-muted-foreground">Date</span>
              <span>{payloadRow ? formatDate(payloadRow.date) : "—"}</span>
              <span className="text-muted-foreground">Customer</span>
              <span>{payloadRow?.customerName ?? "—"} ({payloadRow?.customerEmail ?? "—"})</span>
              <span className="text-muted-foreground">Product</span>
              <span>{payloadRow?.product ?? "—"}</span>
              <span className="text-muted-foreground">Funnel</span>
              <span>{payloadRow?.funnel ?? "—"}</span>
              <span className="text-muted-foreground">Type</span>
              <span>{payloadRow?.orderType ?? "—"}</span>
              <span className="text-muted-foreground">Amount</span>
              <span>{formatUsd(payloadRow?.amount ?? null)}</span>
              <span className="text-muted-foreground">Commission</span>
              <span>{formatUsd(payloadRow?.commission ?? null)}</span>
              <span className="text-muted-foreground">Affiliate</span>
              <span>{payloadRow?.affiliateName ?? "—"}</span>
              <span className="text-muted-foreground">Affiliate Ref</span>
              <span className="font-mono text-xs">{payloadRow?.affiliateRef ?? "—"}</span>
              <span className="text-muted-foreground">Source</span>
              <span>{payloadRow?.source ?? "—"}</span>
              <span className="text-muted-foreground">Sub ID 1</span>
              <span>{payloadRow?.subId ?? "—"}</span>
              <span className="text-muted-foreground">Sub ID 2</span>
              <span>{payloadRow?.subId2 ?? "—"}</span>
              <span className="text-muted-foreground">Sub ID 3</span>
              <span>{payloadRow?.subId3 ?? "—"}</span>
              <span className="text-muted-foreground">Sub ID 4</span>
              <span>{payloadRow?.subId4 ?? "—"}</span>
              <span className="text-muted-foreground">Webhook Status</span>
              <span>{payloadRow?.webhookStatus ?? "—"}</span>
              <span className="text-muted-foreground">Payment</span>
              <span>{payloadRow?.paymentStatus ?? "—"}</span>
              {payloadRow?.reason ? (
                <>
                  <span className="text-muted-foreground">Reason</span>
                  <span className="text-xs">{payloadRow.reason}</span>
                </>
              ) : null}
              <span className="text-muted-foreground">Billing</span>
              <span>{payloadRow?.isRecurring ? "Recurring" : "Initial"}</span>
              <span className="text-muted-foreground">CF Product ID</span>
              <span className="font-mono text-xs">{payloadRow?.cfProductId ?? "—"}</span>
              <span className="text-muted-foreground">CF Order ID</span>
              <span className="font-mono text-xs">{payloadRow?.cfOrderId ?? "—"}</span>
              <span className="text-muted-foreground">CF Subscription ID</span>
              <span className="font-mono text-xs">{payloadRow?.cfSubscriptionId ?? "—"}</span>
              <span className="text-muted-foreground">Click ID</span>
              <span className="break-all font-mono text-xs">{payloadRow?.clickId ?? "—"}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rejectRow}
        onOpenChange={(open) => {
          if (!open && !rejecting) setRejectRow(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject conversion — {rejectRow?.orderId ?? rejectRow?.id}</DialogTitle>
            <DialogDescription>
              {rejectRow?.affiliateName ?? "The affiliate"} loses the{" "}
              {formatUsd(rejectRow?.commission ?? null)} commission for this sale. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="reject-reason" className="text-xs font-medium text-muted-foreground">
              Reason
            </label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Fraudulent order, chargeback, self-purchase"
              maxLength={500}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={rejecting}
              onClick={() => setRejectRow(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejecting || rejectReason.trim().length < 3}
              onClick={() => void submitReject()}
            >
              {rejecting ? "Rejecting…" : "Reject conversion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
