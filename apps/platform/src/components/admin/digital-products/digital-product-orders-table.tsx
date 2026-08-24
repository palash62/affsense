"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
      : lower === "failed"
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

export function DigitalProductOrdersTable({ rows }: { rows: DigitalProductOrderRow[] }) {
  const [payloadRow, setPayloadRow] = useState<DigitalProductOrderRow | null>(null);

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
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Sub ID</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Status</TableHead>
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
                  <OrderTypeBadge type={row.orderType} />
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
                <TableCell className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={row.webhookStatus} />
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3">
                  <PaymentBadge status={row.paymentStatus} />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    title="View event details"
                    onClick={() => setPayloadRow(row)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
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
              <span className="text-muted-foreground">Sub ID</span>
              <span>{payloadRow?.subId ?? "—"}</span>
              <span className="text-muted-foreground">Webhook Status</span>
              <span>{payloadRow?.webhookStatus ?? "—"}</span>
              <span className="text-muted-foreground">Payment</span>
              <span>{payloadRow?.paymentStatus ?? "—"}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
