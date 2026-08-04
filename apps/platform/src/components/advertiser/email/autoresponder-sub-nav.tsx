"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BarChart3,
  FileText,
  Globe,
  LayoutDashboard,
  List,
  Mail,
  ScrollText,
  Settings,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/advertiser/email", icon: LayoutDashboard, exact: true },
  { label: "Subscribers", href: "/advertiser/email/subscribers", icon: Users },
  { label: "Lists", href: "/advertiser/email/lists", icon: List },
  { label: "Automations", href: "/advertiser/email/automations", icon: Zap },
  { label: "Templates", href: "/advertiser/email/templates", icon: FileText },
  { label: "Analytics", href: "/advertiser/email/analytics", icon: BarChart3 },
  { label: "Domain", href: "/advertiser/email/domains", icon: Globe },
  { label: "Email Logs", href: "/advertiser/email/logs", icon: ScrollText },
  { label: "Suppression List", href: "/advertiser/email/suppression", icon: AlertTriangle },
  { label: "Settings", href: "/advertiser/email/settings", icon: Settings },
];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AutoresponderSubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Autoresponder"
      className="w-full shrink-0 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm lg:sticky lg:top-4 lg:w-56 lg:self-start"
    >
      <div className="mb-2 flex items-center gap-2 px-1 lg:mb-3">
        <Mail className="h-4 w-4 text-[var(--theme-primary)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Autoresponder
        </span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** @deprecated Use AutoresponderSubNav */
export const EmailSubNav = AutoresponderSubNav;
