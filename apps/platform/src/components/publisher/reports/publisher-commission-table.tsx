"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ButtonLink } from "@/components/ui/button-link";
import type { PublisherCommissionRow } from "@/services/digital-product.service";

function TypeBadge({ type }: { type: string }) {
  const lower = type.toLowerCase();
  const cls = lower.includes("upsell")
    ? "bg-purple-100 text-purple-700"
    : lower.includes("downsell")
      ? "bg-orange-100 text-orange-700"
      : lower.includes("refund")
        ? "bg-red-100 text-red-700"
        : "bg-blue-100 text-blue-700";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", cls)}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const cls =
    lower === "processed"
      ? "bg-emerald-100 text-emerald-700"
      : lower === "failed"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";
  const label =
    lower === "processed" ? "Approved" : lower === "failed" ? "Failed" : status;
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", cls)}>
      {label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
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

export function PublisherCommissionTable({ rows }: { rows: PublisherCommissionRow[] }) {
  const [detail, setDetail] = useState<PublisherCommissionRow | null>(null);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-base font-semibold text-foreground">No commissions yet</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Promote a product from Marketplace and share your tracked link.
        </p>
        <ButtonLink href="/publisher/marketplace" className="mt-4 h-9">
          Browse marketplace
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Date</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Transaction ID</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Product</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Funnel</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Type</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-right text-xs">Sale</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-right text-xs">Commission</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-xs">Rate</TableHead>
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
                <TableCell className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {formatDate(row.date)}
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium">
                  {row.orderId}
                </TableCell>
                <TableCell className="max-w-[160px] truncate px-4 py-3 text-xs">
                  {row.product ?? "—"}
                </TableCell>
                <TableCell className="max-w-[140px] truncate px-4 py-3 text-xs text-muted-foreground">
                  {row.funnel ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3">
                  <TypeBadge type={row.orderType} />
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold">
                  {formatUsd(row.amount)}
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-emerald-700">
                  {formatUsd(row.commission)}
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {Math.round(row.rate * 100)}%
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
                <TableCell className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {row.paymentStatus ?? "—"}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    title="View details"
                    onClick={() => setDetail(row)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!detail} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Commission detail</SheetTitle>
            <SheetDescription>{detail?.orderId}</SheetDescription>
          </SheetHeader>
          {detail ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pb-6 text-sm">
              <dt className="text-muted-foreground">Date</dt>
              <dd>{formatDate(detail.date)}</dd>
              <dt className="text-muted-foreground">Product</dt>
              <dd>{detail.product ?? "—"}</dd>
              <dt className="text-muted-foreground">Funnel</dt>
              <dd>{detail.funnel ?? "—"}</dd>
              <dt className="text-muted-foreground">Type</dt>
              <dd>{detail.orderType}</dd>
              <dt className="text-muted-foreground">Sale</dt>
              <dd>{formatUsd(detail.amount)}</dd>
              <dt className="text-muted-foreground">Commission</dt>
              <dd>{formatUsd(detail.commission)}</dd>
              <dt className="text-muted-foreground">Rate</dt>
              <dd>{Math.round(detail.rate * 100)}%</dd>
              <dt className="text-muted-foreground">Source</dt>
              <dd>{detail.source ?? "—"}</dd>
              <dt className="text-muted-foreground">Sub ID</dt>
              <dd>{detail.subId ?? "—"}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{detail.webhookStatus}</dd>
              <dt className="text-muted-foreground">Payment</dt>
              <dd>{detail.paymentStatus ?? "—"}</dd>
            </dl>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
