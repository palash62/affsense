"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Webhook } from "lucide-react";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import { cn } from "@/lib/utils";

export function WebhookStatusPanel() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/v1/admin/settings/clickfunnels-webhook")
      .then((r) => r.json())
      .then((json) => {
        if (typeof json.data?.enabled === "boolean") {
          setEnabled(json.data.enabled);
        } else {
          setEnabled(true);
        }
      })
      .catch(() => setEnabled(null));
  }, []);

  const active = enabled !== false;

  return (
    <DashboardCard>
      <div className="flex items-center gap-2">
        <Webhook className="h-4 w-4 text-[var(--theme-primary)]" />
        <DashboardCardTitle>Webhook Integration</DashboardCardTitle>
      </div>
      <DashboardCardDescription className="mt-1">
        Affsense uses one platform-wide ClickFunnels webhook.
      </DashboardCardDescription>

      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">Global Webhook</span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-semibold",
              active ? "text-[var(--theme-success)]" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                active ? "bg-[var(--theme-success)]" : "bg-muted-foreground/40",
              )}
            />
            {enabled === null ? "…" : active ? "Active" : "Inactive"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Managed from{" "}
          <Link
            href="/admin/settings?section=webhooks"
            className="font-medium text-[var(--theme-primary)] hover:underline"
          >
            Settings → Digital Webhook
          </Link>
          . No per-product webhook configuration is required.
        </p>
      </div>
    </DashboardCard>
  );
}
