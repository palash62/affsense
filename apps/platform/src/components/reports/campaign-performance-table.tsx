"use client";

import type { CampaignPerformanceRow } from "@/services/report.service";
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

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

export function CampaignPerformanceTable({
  rows,
  exportFilename = "campaign-performance.csv",
}: {
  rows: CampaignPerformanceRow[];
  exportFilename?: string;
}) {
  const csvRows = rows.map((row) => [
    row.campaignName,
    row.campaignId,
    row.status,
    row.clicks,
    row.leads,
    row.approvedLeads,
    row.pendingLeads,
    row.rejectedLeads,
    row.salesCount,
    row.revenue,
    row.conversionRate,
    row.approvalRate,
    row.spend,
    row.cpl,
  ]);

  if (rows.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-sm text-muted-foreground">
        No campaign activity in this date range.
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end border-b border-border px-4 py-3 sm:px-6">
        <ExportCsvButton
          filename={exportFilename}
          headers={[
            "Campaign",
            "Campaign ID",
            "Status",
            "Clicks",
            "Leads",
            "Approved",
            "Pending",
            "Rejected",
            "Sales",
            "Revenue",
            "Conversion %",
            "Approval %",
            "Spend",
            "CPL",
          ]}
          rows={csvRows}
        />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="min-w-[160px] px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Campaign
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Clicks
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
                Conv.
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Approval
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Spend
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                CPL
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.campaignId} className="border-slate-50">
                <TableCell className="px-4 font-medium text-foreground">
                  <div>{row.campaignName}</div>
                  <div className="text-xs text-muted-foreground">{row.status}</div>
                </TableCell>
                <TableCell className="px-3 text-right tabular-nums">{row.clicks.toLocaleString()}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">{row.leads.toLocaleString()}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">{row.approvedLeads.toLocaleString()}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">{row.pendingLeads.toLocaleString()}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">{row.rejectedLeads.toLocaleString()}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">{row.salesCount.toLocaleString()}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">{formatCurrency(row.revenue)}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">{formatPercent(row.conversionRate)}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">{formatPercent(row.approvalRate)}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">{formatCurrency(row.spend)}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">{formatCurrency(row.cpl)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
