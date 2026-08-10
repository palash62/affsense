import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const dashboardCardClassName =
  "rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-5 shadow-[var(--shadow-card)]";

export function DashboardCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(dashboardCardClassName, className)}>{children}</div>;
}

export function DashboardCardTitle({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <h3 className={cn("text-base font-semibold text-foreground", className)}>{children}</h3>
  );
}

export function DashboardCardDescription({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <p className={cn("mt-0.5 text-sm text-muted-foreground", className)}>{children}</p>;
}
