import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Box, ChevronRight, ClipboardList, FileText, Target } from "lucide-react";
import {
  DashboardCard,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import { cn } from "@/lib/utils";
import { PUBLISHER_GET_PAID_TASKS_ENABLED } from "@/lib/feature-flags";

const ACTIONS: Array<{ label: string; href: string; icon: LucideIcon; iconClass: string }> = [
  {
    label: "Browse CPA Offers",
    href: "/publisher/cpa-offers",
    icon: Target,
    iconClass: "text-[var(--theme-primary)]",
  },
  {
    label: "Digital Products",
    href: "/publisher/marketplace",
    icon: Box,
    iconClass: "text-[var(--theme-success)]",
  },
  ...(PUBLISHER_GET_PAID_TASKS_ENABLED
    ? [
        {
          label: "Get Paid Tasks",
          href: "/publisher/get-paid-tasks",
          icon: ClipboardList,
          iconClass: "text-[var(--theme-primary)]",
        },
      ]
    : []),
  {
    label: "View Reports",
    href: "/publisher/reports/commissions",
    icon: BarChart3,
    iconClass: "text-blue-600",
  },
  {
    label: "Invoices",
    href: "/publisher/invoices",
    icon: FileText,
    iconClass: "text-[var(--theme-success)]",
  },
];

export function PublisherQuickActions() {
  return (
    <DashboardCard className="h-full">
      <DashboardCardTitle>Quick Actions</DashboardCardTitle>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ACTIONS.map(({ label, href, icon: Icon, iconClass }) => (
          <Link
            key={href}
            href={href}
            className="group flex min-h-[104px] flex-col justify-between rounded-xl border border-border bg-muted/30 p-3.5 transition-colors hover:border-[color-mix(in_srgb,var(--theme-primary)_40%,var(--border))] hover:bg-card"
          >
            <Icon className={cn("h-6 w-6", iconClass)} strokeWidth={2.25} />
            <span className="mt-3 flex items-end justify-between gap-1">
              <span className="text-xs font-medium leading-snug text-foreground">{label}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--theme-primary)] transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}
