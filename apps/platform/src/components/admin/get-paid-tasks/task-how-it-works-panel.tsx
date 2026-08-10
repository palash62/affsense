import {
  DashboardCard,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import { HOW_IT_WORKS_STEPS } from "./mock-data";

export function TaskHowItWorksPanel() {
  return (
    <DashboardCard>
      <DashboardCardTitle>How It Works</DashboardCardTitle>
      <ol className="mt-3 space-y-3">
        {HOW_IT_WORKS_STEPS.map((step, index) => (
          <li key={step} className="flex items-start gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--theme-primary-soft)] text-xs font-bold text-[var(--theme-primary)]">
              {index + 1}
            </span>
            <span className="pt-0.5 text-foreground">{step}</span>
          </li>
        ))}
      </ol>
    </DashboardCard>
  );
}
