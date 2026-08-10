import { CheckCircle2 } from "lucide-react";
import {
  DashboardCard,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import { TASK_GUIDELINES } from "./mock-data";

export function TaskGuidelinesPanel() {
  return (
    <DashboardCard className="border-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] bg-[var(--theme-primary-soft)]">
      <DashboardCardTitle>Task Guidelines</DashboardCardTitle>
      <ul className="mt-3 space-y-2.5">
        {TASK_GUIDELINES.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
