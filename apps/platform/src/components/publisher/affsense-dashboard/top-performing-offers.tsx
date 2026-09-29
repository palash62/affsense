import {
  DashboardCard,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import {
  DashboardSourceChip,
  DashboardViewAllLink,
  type DashboardOfferSource,
} from "@/components/publisher/affsense-dashboard/dashboard-source-chip";

export type TopOfferRow = {
  source: DashboardOfferSource;
  name: string;
  clicks: number;
  conversions: number;
  earnings: number;
  cr: number;
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function TopPerformingOffers({ rows }: { rows: TopOfferRow[] }) {
  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2">
        <DashboardCardTitle>Top Performing Offers</DashboardCardTitle>
        <DashboardViewAllLink href="/publisher/reports/offers" />
      </div>
      {rows.length === 0 ? (
        <div className="flex min-h-[180px] flex-1 items-center justify-center text-sm text-muted-foreground">
          No offer activity in this period
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-2 font-medium">#</th>
                <th className="py-2 pr-2 font-medium">Offer</th>
                <th className="py-2 pr-2 text-right font-medium">Clicks</th>
                <th className="py-2 pr-2 text-right font-medium">Conversions</th>
                <th className="py-2 pr-2 text-right font-medium">Earnings</th>
                <th className="py-2 text-right font-medium">CR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.source}-${row.name}`}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="py-2.5 pr-2 text-muted-foreground">{index + 1}</td>
                  <td className="py-2.5 pr-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <DashboardSourceChip source={row.source} />
                      <span className="truncate font-medium text-foreground" title={row.name}>
                        {row.name}
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-2 text-right">{row.clicks.toLocaleString("en-US")}</td>
                  <td className="py-2.5 pr-2 text-right">
                    {row.conversions.toLocaleString("en-US")}
                  </td>
                  <td className="py-2.5 pr-2 text-right font-medium">{formatMoney(row.earnings)}</td>
                  <td className="py-2.5 text-right">{row.cr.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  );
}
