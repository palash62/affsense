import {
  DashboardCard,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import {
  DashboardSourceChip,
  DashboardViewAllLink,
  type DashboardOfferSource,
} from "@/components/publisher/affsense-dashboard/dashboard-source-chip";
import { cn } from "@/lib/utils";
import { PUBLISHER_GET_PAID_TASKS_ENABLED } from "@/lib/feature-flags";

export type RecentConversionRow = {
  source: DashboardOfferSource;
  name: string;
  amount: number;
  date: string;
  status: "Pending" | "Approved" | "Rejected" | "Failed" | "Refunded";
};

const STATUS_STYLES: Record<RecentConversionRow["status"], string> = {
  Pending: "bg-amber-50 text-amber-700",
  Approved: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-red-50 text-red-700",
  Failed: "bg-red-50 text-red-700",
  Refunded: "bg-muted text-muted-foreground",
};

const REPORT_BY_SOURCE: Record<string, string> = {
  digital: "/publisher/marketplace/report",
  cpa: "/publisher/cpa-offers/report",
  offerwall: "/publisher/offer-wall/report",
  ...(PUBLISHER_GET_PAID_TASKS_ENABLED ? { tasks: "/publisher/reports/tasks" } : {}),
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RecentConversions({
  rows,
  source,
}: {
  rows: RecentConversionRow[];
  source: string;
}) {
  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2">
        <DashboardCardTitle>Recent Conversions</DashboardCardTitle>
        <DashboardViewAllLink href={REPORT_BY_SOURCE[source] ?? "/publisher/reports/commissions"} />
      </div>
      {rows.length === 0 ? (
        <div className="flex min-h-[180px] flex-1 items-center justify-center text-sm text-muted-foreground">
          No conversions yet
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-2 font-medium">Offer</th>
                <th className="py-2 pr-2 text-right font-medium">Amount</th>
                <th className="py-2 pr-2 font-medium">Date</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.source}-${row.date}-${index}`}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="py-2.5 pr-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <DashboardSourceChip source={row.source} />
                      <span className="truncate font-medium text-foreground" title={row.name}>
                        {row.name}
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-2 text-right font-medium">{formatMoney(row.amount)}</td>
                  <td
                    className="whitespace-nowrap py-2.5 pr-2 text-muted-foreground"
                    suppressHydrationWarning
                  >
                    {formatDate(row.date)}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={cn(
                        "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold",
                        STATUS_STYLES[row.status],
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  );
}
