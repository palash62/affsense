import Link from "next/link";
import {
  Building2,
  Megaphone,
  FileText,
  BarChart3,
  Users,
  Download,
  Wallet,
  LifeBuoy,
} from "lucide-react";
import { cn } from "@/lib/utils";

const actions = [
  {
    label: "Create Campaign",
    description: "Launch a new CPL campaign",
    href: "/admin/campaigns",
    icon: Megaphone,
    iconBg: "bg-orange-50 text-orange-600",
  },
  {
    label: "Add Advertiser",
    description: "Register a new advertiser account",
    href: "/admin/advertisers",
    icon: Building2,
    iconBg: "bg-purple-50 text-purple-600",
  },
  {
    label: "Add Publisher",
    description: "Onboard a lead publisher",
    href: "/admin/publishers",
    icon: Users,
    iconBg: "bg-emerald-50 text-emerald-600",
  },
  {
    label: "Review Leads",
    description: "Approve or reject submissions",
    href: "/admin/leads",
    icon: FileText,
    iconBg: "bg-violet-50 text-violet-600",
  },
  {
    label: "Review Withdrawals",
    description: "Process publisher payout requests",
    href: "/admin/payouts",
    icon: Wallet,
    iconBg: "bg-cyan-50 text-cyan-600",
  },
  {
    label: "Export Reports",
    description: "Download platform analytics",
    href: "/admin/reports",
    icon: Download,
    iconBg: "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]",
  },
  {
    label: "Support Tickets",
    description: "Respond to customer issues",
    href: "/admin/support",
    icon: LifeBuoy,
    iconBg: "bg-rose-50 text-rose-600",
  },
  {
    label: "Platform Reports",
    description: "View detailed analytics",
    href: "/admin/reports",
    icon: BarChart3,
    iconBg: "bg-indigo-50 text-indigo-600",
  },
];

export function AdminQuickActions() {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-foreground">Quick Actions</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href + action.label}
              href={action.href}
              className="group flex items-start gap-3.5 rounded-[18px] border border-border bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-md"
            >
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-105",
                  action.iconBg,
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{action.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {action.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
