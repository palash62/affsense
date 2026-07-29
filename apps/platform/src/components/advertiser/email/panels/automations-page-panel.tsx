"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { EmailAutomationsPanel } from "../email-automations-panel";
import { EmailModuleShell } from "../email-module-shell";

export function AutomationsPagePanel() {
  const [stats, setStats] = useState<{ activeAutomations: number; totalSends: number } | null>(null);

  useEffect(() => {
    fetch("/api/v1/advertiser/email/stats")
      .then((r) => r.json())
      .then((j) =>
        setStats({
          activeAutomations: j.data?.activeAutomations ?? 0,
          totalSends: j.data?.totalSends ?? 0,
        }),
      )
      .catch(() => {});
  }, []);

  return (
    <EmailModuleShell
      title="Automations"
      description="Automated drip sequences triggered when leads are captured or approved."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Automations" },
      ]}
      stats={[
        { label: "Active", value: stats ? stats.activeAutomations.toLocaleString() : "—", icon: Zap, accent: "green" },
        { label: "Total Sends", value: stats ? stats.totalSends.toLocaleString() : "—", icon: Zap, variant: "leads" },
      ]}
      searchPlaceholder="Search automations…"
      primaryAction={{ label: "Create Automation", href: "/advertiser/email/automations/new", icon: Zap }}
    >
      <EmailAutomationsPanel />
    </EmailModuleShell>
  );
}
