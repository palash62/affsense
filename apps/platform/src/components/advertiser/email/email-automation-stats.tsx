"use client";

import { useEffect, useState } from "react";

type StepStat = {
  stepId: string;
  order: number;
  delayMinutes: number;
  sent: number;
  opens: number;
  clicks: number;
  openRate: number;
  clickRate: number;
};

export function EmailAutomationStats({ automationId }: { automationId: string }) {
  const [stats, setStats] = useState<{ steps: StepStat[] } | null>(null);

  useEffect(() => {
    fetch(`/api/v1/advertiser/email/automations/${automationId}/stats`)
      .then((r) => r.json())
      .then((d) => setStats(d.data));
  }, [automationId]);

  if (!stats?.steps?.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {stats.steps.map((s) => (
        <div key={s.stepId} className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="font-medium text-foreground">Step {s.order + 1}</p>
          <p className="text-muted-foreground">{s.sent} sent · {s.openRate}% opens · {s.clickRate}% clicks</p>
        </div>
      ))}
    </div>
  );
}
