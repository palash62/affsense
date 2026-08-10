"use client";

import type { GeoBreakdownRow } from "@/services/report.service";
import { formatCurrency } from "@/components/admin/admin-ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExportCsvButton } from "@/components/reports/export-csv-button";

export function GeoBreakdownTable({
  rows,
  exportFilename = "geo-breakdown.csv",
}: {
  rows: GeoBreakdownRow[];
  exportFilename?: string;
}) {
  const csvRows = rows.map((row) => [row.country, row.leads, row.approvedLeads, row.spend]);

  if (rows.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-sm text-muted-foreground">
        No geo data in this date range.
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end border-b border-border px-4 py-3 sm:px-6">
        <ExportCsvButton
          filename={exportFilename}
          headers={["Country", "Leads", "Approved", "Spend"]}
          rows={csvRows}
        />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Country
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Leads
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Approved
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Spend
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.country} className="border-slate-50">
                <TableCell className="px-4 font-medium text-foreground">{row.country}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">{row.leads.toLocaleString()}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">
                  {row.approvedLeads.toLocaleString()}
                </TableCell>
                <TableCell className="px-3 text-right tabular-nums">{formatCurrency(row.spend)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
