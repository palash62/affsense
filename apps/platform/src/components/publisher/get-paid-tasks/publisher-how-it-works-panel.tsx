import {
  DashboardCard,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";

const STEPS = [
  "Browse available tasks and pick one to start",
  "Complete the required action using the provided link",
  "Submit proof when required for admin review",
  "Get paid automatically after your submission is approved",
];

export function PublisherHowItWorksPanel() {
  return (
    <DashboardCard>
      <DashboardCardTitle>How It Works</DashboardCardTitle>
      <ol className="mt-3 space-y-3">
        {STEPS.map((step, index) => (
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
