"use client";

import type { UserRole } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  LayoutDashboard,
  Users,
  Megaphone,
  FileText,
  Wallet,
  Banknote,
  BarChart3,
  LifeBuoy,
  Settings,
  ScrollText,
  Link2,
  TrendingUp,
  Gift,
  LayoutTemplate,
  FileStack,
  Palette,
  ShieldAlert,
  Plug,
  Mail,
  PlayCircle,
  Globe,
  Store,
  Webhook,
  UserCog,
} from "lucide-react";
import { STAFF_USERS_PATH } from "@/lib/admin-portal";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: NavItem[];
}

export const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: STAFF_USERS_PATH, icon: UserCog },
  { label: "Profit", href: "/admin/profit", icon: TrendingUp },
  { label: "Advertisers", href: "/admin/advertisers", icon: Users },
  { label: "Publishers", href: "/admin/publishers", icon: Users },
  { label: "Campaigns", href: "/admin/campaigns", icon: Megaphone },
  {
    label: "CPA Offers",
    href: "/admin/cpa-offers",
    icon: Store,
    children: [
      { label: "Dashboard", href: "/admin/cpa-offers", icon: LayoutDashboard },
      { label: "All Offers", href: "/admin/cpa-offers/offers", icon: Store },
      { label: "Report", href: "/admin/cpa-offers/report", icon: BarChart3 },
      { label: "CPA Payouts", href: "/admin/cpa-offers/payouts", icon: Banknote },
      { label: "Global Postback", href: "/admin/global-postback", icon: Webhook },
    ],
  },
  { label: "Bulk Email", href: "/admin/bulk-email", icon: Mail },
  { label: "Leads", href: "/admin/leads", icon: FileText },
  { label: "Fraud Center", href: "/admin/fraud", icon: ShieldAlert },
  { label: "Wallets", href: "/admin/wallets", icon: Wallet },
  { label: "Deposits", href: "/admin/deposits", icon: ArrowDownToLine },
  { label: "Payouts", href: "/admin/payouts", icon: Banknote },
  { label: "Referrals", href: "/admin/referrals", icon: Gift },
  { label: "Reports", href: "/admin/reports", icon: BarChart3 },
  { label: "Support", href: "/admin/support", icon: LifeBuoy },
  { label: "Settings", href: "/admin/settings", icon: Settings },
  { label: "Audit Log", href: "/admin/audit-log", icon: ScrollText },
  { label: "Themes", href: "/admin/themes", icon: Palette },
  { label: "Funnel Templates", href: "/admin/funnel-templates", icon: FileStack },
  { label: "Tutorials", href: "/admin/tutorials", icon: PlayCircle },
];

export const ADVERTISER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/advertiser", icon: LayoutDashboard },
  { label: "Domains", href: "/advertiser/domains", icon: Globe },
  { label: "Funnels", href: "/advertiser/optin-funnels", icon: LayoutTemplate },
  { label: "Campaigns", href: "/advertiser/campaigns", icon: Megaphone },
  {
    label: "CPA Offers",
    href: "/advertiser/cpa-offers",
    icon: Store,
    children: [
      { label: "Offer Marketplace", href: "/advertiser/cpa-offers", icon: Store },
      { label: "Dashboard", href: "/advertiser/cpa-offers/dashboard", icon: LayoutDashboard },
      { label: "Report", href: "/advertiser/cpa-offers/report", icon: BarChart3 },
      { label: "Wallet", href: "/advertiser/cpa-offers/wallet", icon: Wallet },
      { label: "Global Postback", href: "/advertiser/global-postback", icon: Webhook },
    ],
  },
  { label: "Integrations", href: "/advertiser/integrations", icon: Plug },
  { label: "Lead Report", href: "/advertiser/lead-report", icon: BarChart3 },
  { label: "Lead Details", href: "/advertiser/lead-details", icon: FileText },
  { label: "Wallet", href: "/advertiser/wallet", icon: Wallet },
  { label: "Referrals", href: "/advertiser/referal_link", icon: Gift },
  { label: "Reports", href: "/advertiser/reports", icon: BarChart3 },
  { label: "Support", href: "/advertiser/support", icon: LifeBuoy },
  { label: "Tutorials", href: "/advertiser/tutorials", icon: PlayCircle },
  { label: "Settings", href: "/advertiser/settings", icon: Settings },
  { label: "Autoresponder", href: "/advertiser/email", icon: Mail },
];

export const PUBLISHER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/publisher", icon: LayoutDashboard },
  { label: "Smart Link", href: "/publisher/smart-link", icon: Link2 },
  { label: "Leads", href: "/publisher/leads", icon: FileText },
  { label: "Lead Report", href: "/publisher/lead-report", icon: BarChart3 },
  { label: "Earnings & Payouts", href: "/publisher/earnings", icon: Wallet },
  { label: "Support", href: "/publisher/support", icon: LifeBuoy },
  { label: "Settings", href: "/publisher/settings", icon: Settings },
];

export function getNavForRole(
  role: UserRole,
  options?: {
    canAccessCpaOffers?: boolean;
    canAccessAutoresponder?: boolean;
    staffMenuAccess?: string[];
  },
): NavItem[] {
  switch (role) {
    case "ADMIN":
      return ADMIN_NAV;
    case "PLATFORM_MANAGER": {
      const allowed = new Set(options?.staffMenuAccess ?? []);
      return ADMIN_NAV.filter((item) => {
        if (item.href === "/admin") return true;
        if (item.href === STAFF_USERS_PATH) return false;
        return allowed.has(item.href);
      });
    }
    case "ADVERTISER": {
      let items = ADVERTISER_NAV;
      if (options?.canAccessCpaOffers === false) {
        items = items.filter((item) => item.href !== "/advertiser/cpa-offers");
      }
      if (options?.canAccessAutoresponder === false) {
        items = items.filter((item) => item.href !== "/advertiser/email");
      }
      return items;
    }
    case "PUBLISHER":
      return PUBLISHER_NAV;
    default:
      return [];
  }
}
