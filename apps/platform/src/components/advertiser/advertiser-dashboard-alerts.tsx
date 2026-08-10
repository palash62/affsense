import Link from "next/link";
import { AlertTriangle, Bell } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";

export type AdvertiserAlertItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: Date;
};

function alertHref(type: string): string {
  if (type.startsWith("wallet.low_balance")) return "/advertiser/wallet";
  if (type === "campaign.budget_reached" || type === "campaign.paused") {
    return "/advertiser/campaigns";
  }
  return "/advertiser/notifications";
}

export function AdvertiserDashboardAlerts({ alerts }: { alerts: AdvertiserAlertItem[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <Bell className="h-4 w-4" />
          Alerts
        </div>
        <ButtonLink
          href="/advertiser/notifications"
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-amber-800 hover:bg-amber-100 hover:text-amber-950"
        >
          View all
        </ButtonLink>
      </div>
      <ul className="space-y-2">
        {alerts.map((alert) => (
          <li key={alert.id}>
            <Link
              href={alertHref(alert.type)}
              className={cn(
                "flex gap-2 rounded-xl border border-amber-100 bg-card/80 px-3 py-2.5 transition hover:border-amber-300 hover:bg-white",
              )}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{alert.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{alert.body}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
