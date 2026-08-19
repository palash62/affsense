"use client";

import { Webhook } from "lucide-react";
import { DashboardCard, DashboardCardTitle } from "@/components/admin/affsense-dashboard/dashboard-card";

export function WebhookStatusPanel() {
  return (
    <DashboardCard>
      <div className="flex items-center justify-between gap-2">
        <DashboardCardTitle>Webhook Status</DashboardCardTitle>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          Not configured
        </span>
      </div>
      <div className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
        <Webhook className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No webhook configured</p>
        <p className="max-w-xs text-xs text-muted-foreground/70">
          A webhook URL will appear here after the product is saved. Configure it in your
          funnel platform to receive conversion events.
        </p>
      </div>
    </DashboardCard>
  );
}
