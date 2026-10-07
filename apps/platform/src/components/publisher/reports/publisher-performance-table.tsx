"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/components/admin/admin-ui";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { nextReportSort, sortRows, type ReportSort } from "@/lib/report-sort";
import type { PerformanceRow } from "@/lib/publisher-performance";
import type { PublisherPerformanceDay } from "@/services/publisher-dashboard.service";

const ACCESSORS: Record<string, (row: PublisherPerformanceDay) => string | number> = {
  date: (row) => row.date,
  clicks: (row) => row.clicks,
  conversions: (row) => row.conversions,
  cr: (row) => row.cr,
  epc: (row) => row.epc,
  earnings: (row) => row.earnings,
};

function formatDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PublisherPerformanceTable({
  series,
  totals,
}: {
  series: PublisherPerformanceDay[];
  totals: PerformanceRow;
}) {
  const [sort, setSort] = useState<ReportSort>({ by: "date", dir: "desc" });
  const rows = useMemo(() => sortRows(series, { sortBy: sort.by, sortDir: sort.dir }, ACCESSORS), [series, sort]);
  const onSort = (column: string) => setSort((current) => nextReportSort(current, column));

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <SortableTableHead label="Date" column="date" sort={sort} onSort={onSort} />
            <SortableTableHead label="Clicks" column="clicks" sort={sort} onSort={onSort} align="right" />
            <SortableTableHead label="Conversions" column="conversions" sort={sort} onSort={onSort} align="right" />
            <SortableTableHead label="CR%" column="cr" sort={sort} onSort={onSort} align="right" />
            <SortableTableHead label="EPC" column="epc" sort={sort} onSort={onSort} align="right" />
            <SortableTableHead label="Earnings" column="earnings" sort={sort} onSort={onSort} align="right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                No days in this range.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const idle = row.clicks === 0 && row.conversions === 0 && row.earnings === 0;
              return (
                <TableRow key={row.date} className={idle ? "text-muted-foreground" : undefined}>
                  <TableCell className="font-medium">{formatDay(row.date)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.clicks.toLocaleString("en-US")}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.conversions.toLocaleString("en-US")}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.cr.toFixed(2)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(row.epc)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(row.earnings)}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
        {rows.length > 0 ? (
          <TableFooter>
            <TableRow className="font-semibold">
              <TableCell>Total</TableCell>
              <TableCell className="text-right tabular-nums">{totals.clicks.toLocaleString("en-US")}</TableCell>
              <TableCell className="text-right tabular-nums">{totals.conversions.toLocaleString("en-US")}</TableCell>
              <TableCell className="text-right tabular-nums">{totals.cr.toFixed(2)}%</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(totals.epc)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(totals.earnings)}</TableCell>
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </div>
  );
}
