"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DashboardCard, DashboardCardTitle } from "@/components/admin/affsense-dashboard/dashboard-card";
import { MOCK_WEBHOOK_STATS, MOCK_WEBHOOK_URL } from "./mock-data";

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy to clipboard");
  }
}

export function WebhookStatusPanel() {
  return (
    <DashboardCard>
      <div className="flex items-center justify-between gap-2">
        <DashboardCardTitle>Webhook Status</DashboardCardTitle>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Connected
        </span>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-muted-foreground">Webhook URL</p>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-2.5 py-2 text-xs text-foreground">
            {MOCK_WEBHOOK_URL}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg"
            onClick={() => copyText(MOCK_WEBHOOK_URL, "Webhook URL")}
            aria-label="Copy webhook URL"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Last Event</dt>
          <dd className="mt-0.5 font-medium text-foreground">{MOCK_WEBHOOK_STATS.lastEvent}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Total Events</dt>
          <dd className="mt-0.5 font-medium text-foreground">{MOCK_WEBHOOK_STATS.totalEvents}</dd>
        </div>
      </dl>

      <Button
        type="button"
        variant="outline"
        className="mt-4 h-10 w-full rounded-xl border-border"
        onClick={() => toast.success("Test webhook sent")}
      >
        Send Test Webhook
      </Button>
    </DashboardCard>
  );
}
