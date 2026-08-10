"use client";

import type { AdvertiserPublisherLeadReportRow } from "@/services/lead.service";
import { shortPublisherId } from "@/lib/advertiser-leads";
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

function formatPayoutRange(min: number | null, max: number | null) {
  if (min === null || max === null) return "—";
  if (min === max) return formatCurrency(min);
  return `${formatCurrency(min)} – ${formatCurrency(max)}`;
}

export function PublisherPerformanceTable({
  rows,
  exportFilename = "publisher-performance.csv",
}: {
  rows: AdvertiserPublisherLeadReportRow[];
  exportFilename?: string;
}) {
  const csvRows = rows.map((row) => [
    row.publisherId,
    row.totalLeads,
    row.approvedLeads,
    row.pendingLeads,
    row.rejectedLeads,
    row.paidLeads,
    row.salesCount,
    row.revenue,
    row.estimatedSpend,
    row.payoutMin,
    row.payoutMax,
  ]);

  if (rows.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-sm text-muted-foreground">
        No publisher activity in this date range.
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end border-b border-border px-4 py-3 sm:px-6">
        <ExportCsvButton
          filename={exportFilename}
          headers={[
            "Publisher ID",
            "Total Leads",
            "Approved",
            "Pending",
            "Rejected",
            "Paid",
            "Sales",
            "Revenue",
            "Estimated Spend",
            "Payout Min",
            "Payout Max",
          ]}
          rows={csvRows}
        />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Publisher
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Leads
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Approved
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pending
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Rejected
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sales
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Revenue
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Spend
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                CPL range
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.publisherId} className="border-slate-50">
                <TableCell className="px-4 font-mono text-sm text-foreground">
                  {shortPublisherId(row.publisherId)}
                </TableCell>
                <TableCell className="px-3 text-right tabular-nums">{row.totalLeads.toLocaleString()}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">
                  {row.approvedLeads.toLocaleString()}
                </TableCell>
                <TableCell className="px-3 text-right tabular-nums">{row.pendingLeads.toLocaleString()}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">
                  {row.rejectedLeads.toLocaleString()}
                </TableCell>
                <TableCell className="px-3 text-right tabular-nums">
                  {row.salesCount.toLocaleString()}
                </TableCell>
                <TableCell className="px-3 text-right tabular-nums">
                  {formatCurrency(row.revenue)}
                </TableCell>
                <TableCell className="px-3 text-right tabular-nums">
                  {formatCurrency(row.estimatedSpend)}
                </TableCell>
                <TableCell className="px-3 text-right tabular-nums">
                  {formatPayoutRange(row.payoutMin, row.payoutMax)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
