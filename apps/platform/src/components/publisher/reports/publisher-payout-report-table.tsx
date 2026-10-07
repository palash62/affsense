"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Banknote } from "lucide-react";
import { formatCurrency } from "@/components/admin/admin-ui";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { formatPayoutMethod } from "@/lib/payout";
import type { PayoutReportRow, PayoutReportStatus } from "@/lib/publisher-payout-report";
import { nextReportSort, setReportSortParams, type ReportSort } from "@/lib/report-sort";
import { formatUserDateTime } from "@/lib/user-timezone";

const STATUS_CLASS: Record<PayoutReportStatus, string> = {
  Paid: "bg-emerald-50 text-emerald-700",
  Pending: "bg-amber-50 text-amber-700",
  Rejected: "bg-red-50 text-red-700",
};

export function PublisherPayoutReportTable({
  rows,
  timezone,
}: {
  rows: PayoutReportRow[];
  timezone: string | null | undefined;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sortBy = searchParams.get("sortBy");
  const sort: ReportSort = sortBy
    ? { by: sortBy, dir: searchParams.get("sortDir") === "asc" ? "asc" : "desc" }
    : { by: "date", dir: "desc" };

  function onSort(column: string) {
    const params = new URLSearchParams(searchParams.toString());
    setReportSortParams(params, nextReportSort(sort, column));
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <Banknote className="mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">No payouts for these filters</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Invoices are created every Monday once your earnings reach the minimum.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <SortableTableHead label="Date" column="date" sort={sort} onSort={onSort} />
            <SortableTableHead label="Type" column="type" sort={sort} onSort={onSort} />
            <SortableTableHead label="Reference" column="reference" sort={sort} onSort={onSort} />
            <SortableTableHead label="Method" column="method" sort={sort} onSort={onSort} />
            <SortableTableHead label="Amount" column="amount" sort={sort} onSort={onSort} align="right" />
            <SortableTableHead label="Status" column="status" sort={sort} onSort={onSort} />
            <SortableTableHead label="Paid on" column="paidAt" sort={sort} onSort={onSort} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.type}:${row.id}`}>
              <TableCell className="whitespace-nowrap text-sm">
                {formatUserDateTime(row.date, timezone, "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.type}</TableCell>
              <TableCell className="font-mono text-xs">
                {row.type === "Invoice" ? (
                  <Link
                    href={`/publisher/invoices/${row.id}/print`}
                    target="_blank"
                    className="text-[var(--theme-primary)] hover:underline"
                  >
                    {row.reference}
                  </Link>
                ) : (
                  row.reference
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.method ? formatPayoutMethod(row.method) : "—"}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(row.amount)}</TableCell>
              <TableCell>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[row.status]}`}>
                  {row.status}
                </span>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {row.paidAt ? formatUserDateTime(row.paidAt, timezone, "MMM d, yyyy") : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
