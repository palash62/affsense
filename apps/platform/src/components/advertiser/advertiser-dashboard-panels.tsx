import Link from "next/link";
import { formatCurrency } from "@/components/admin/admin-ui";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SummaryRow {
  label: string;
  leads: number;
  cpl: number;
  spent: number;
}

export function AdvertiserSummaryTable({ rows }: { rows: SummaryRow[] }) {
  return (
    <DashboardCard className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4">
        <DashboardCardTitle>Summary Stats</DashboardCardTitle>
        <DashboardCardDescription>
          Approved leads, CPL, and spend across time periods
        </DashboardCardDescription>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-border bg-muted/40 hover:bg-transparent">
            <TableHead className="h-10 px-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Period
            </TableHead>
            <TableHead className="h-10 px-4 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Approved Leads
            </TableHead>
            <TableHead className="h-10 px-4 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
              CPL
            </TableHead>
            <TableHead className="h-10 px-5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Spent
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.label}
              className="border-border/80 transition-colors hover:bg-muted/30"
            >
              <TableCell className="px-5 py-3 font-medium text-foreground">{row.label}</TableCell>
              <TableCell className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                {row.leads}
              </TableCell>
              <TableCell className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-[var(--theme-primary)]">
                {formatCurrency(row.cpl)}
              </TableCell>
              <TableCell className="px-5 py-3 text-right text-sm font-medium tabular-nums text-foreground">
                {formatCurrency(row.spent)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DashboardCard>
  );
}

export function AdvertiserPendingQueue({
  leads,
}: {
  leads: Array<{ id: string; status: string; campaign: { name: string } }>;
}) {
  return (
    <DashboardCard className="flex h-full flex-col">
      <DashboardCardTitle>Pending Review</DashboardCardTitle>
      <DashboardCardDescription>Leads awaiting your approval</DashboardCardDescription>
      <div className="mt-4 flex-1">
        {leads.length === 0 ? (
          <div className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
            No leads pending review
          </div>
        ) : (
          <div className="divide-y divide-border">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="truncate text-sm font-medium text-foreground">
                  {lead.campaign.name}
                </span>
                <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium capitalize text-amber-700">
                  {lead.status.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <Link
        href="/advertiser/leads?status=PENDING"
        className="mt-4 text-sm font-medium text-[var(--theme-primary)] hover:underline"
      >
        Review all →
      </Link>
    </DashboardCard>
  );
}
