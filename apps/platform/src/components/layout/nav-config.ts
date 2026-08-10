import type { UserRole } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  ArrowDownToLine,
  LayoutDashboard,
  History,
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
  CreditCard,
  ShieldCheck,
  Package,
  ShoppingCart,
  Percent,
  ListTodo,
  ClipboardList,
  Plus,
  Tags,
  HandCoins,
  Bell,
  Image,
  Files,
  Images,
  Landmark,
  Lock,
  Ticket,
  Share2,
} from "lucide-react";
import { STAFF_USERS_PATH } from "@/lib/admin-portal";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: NavItem[];
}

export type AdminNavEntry =
  | { kind: "section"; label: string }
  | { kind: "item"; item: NavItem };

/** Legacy admin routes preserved under Old Menu (also used for staff menu assignment UI). */
export const ADMIN_LEGACY_NAV: NavItem[] = [
  { label: "Old Dashboard", href: "/admin/old-dashboard", icon: History },
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

export const ADMIN_NAV: AdminNavEntry[] = [
  { kind: "section", label: "MAIN" },
  { kind: "item", item: { label: "Dashboard", href: "/admin", icon: LayoutDashboard } },
  {
    kind: "item",
    item: {
      label: "Users",
      href: "/admin/publishers",
      icon: Users,
      children: [
        { label: "Affiliates", href: "/admin/publishers", icon: Share2 },
        { label: "Manager", href: "/admin/users", icon: UserCog },
      ],
    },
  },
  { kind: "item", item: { label: "Memberships", href: "/admin/memberships", icon: CreditCard } },
  { kind: "item", item: { label: "KYC Verification", href: "/admin/kyc", icon: ShieldCheck } },
  {
    kind: "item",
    item: {
      label: "Digital Products",
      href: "/admin/digital-products",
      icon: Package,
      children: [
        { label: "All Products", href: "/admin/digital-products", icon: Package },
        { label: "Add New Product", href: "/admin/digital-products/new", icon: Plus },
        { label: "Product Categories", href: "/admin/digital-products/categories", icon: Tags },
      ],
    },
  },
  {
    kind: "item",
    item: {
      label: "Get Paid Tasks",
      href: "/admin/get-paid-tasks",
      icon: ClipboardList,
      children: [
        { label: "All Tasks", href: "/admin/get-paid-tasks", icon: ListTodo },
        { label: "Add New Task", href: "/admin/get-paid-tasks/new", icon: Plus },
        { label: "Task Categories", href: "/admin/get-paid-tasks/categories", icon: Tags },
      ],
    },
  },
  { kind: "item", item: { label: "CPA Offers", href: "/admin/offer-network", icon: Store } },
  {
    kind: "item",
    item: { label: "Orders & Sales", href: "/admin/orders-sales", icon: ShoppingCart },
  },
  { kind: "item", item: { label: "Commissions", href: "/admin/commissions", icon: Percent } },
  { kind: "item", item: { label: "Payouts", href: "/admin/payout-center", icon: Wallet } },
  {
    kind: "item",
    item: { label: "Referrals", href: "/admin/referral-program", icon: Gift },
  },
  {
    kind: "item",
    item: { label: "Withdrawals", href: "/admin/withdrawals", icon: HandCoins },
  },
  {
    kind: "item",
    item: { label: "Support Tickets", href: "/admin/support-tickets", icon: Ticket },
  },

  { kind: "section", label: "MARKETING" },
  { kind: "item", item: { label: "Promotions", href: "/admin/promotions", icon: Megaphone } },
  {
    kind: "item",
    item: { label: "Email Campaigns", href: "/admin/email-campaigns", icon: Mail },
  },
  {
    kind: "item",
    item: { label: "Announcements", href: "/admin/announcements", icon: Bell },
  },
  { kind: "item", item: { label: "Banners", href: "/admin/banners", icon: Image } },

  { kind: "section", label: "CONTENT" },
  { kind: "item", item: { label: "Blog Posts", href: "/admin/blog-posts", icon: FileText } },
  { kind: "item", item: { label: "Pages", href: "/admin/content-pages", icon: Files } },
  {
    kind: "item",
    item: { label: "Media Library", href: "/admin/media-library", icon: Images },
  },

  { kind: "section", label: "SETTINGS" },
  {
    kind: "item",
    item: { label: "General Settings", href: "/admin/general-settings", icon: Settings },
  },
  {
    kind: "item",
    item: { label: "Payment Settings", href: "/admin/payment-settings", icon: Landmark },
  },
  { kind: "item", item: { label: "Security", href: "/admin/security", icon: Lock } },
  {
    kind: "item",
    item: { label: "System Logs", href: "/admin/system-logs", icon: ScrollText },
  },
  { kind: "item", item: { label: "Themes", href: "/admin/themes", icon: Palette } },

  { kind: "section", label: "OLD" },
  {
    kind: "item",
    item: {
      label: "Old Menu",
      href: "/admin/old-menu",
      icon: Archive,
      children: ADMIN_LEGACY_NAV,
    },
  },
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

function asNavEntries(items: NavItem[]): AdminNavEntry[] {
  return items.map((item) => ({ kind: "item" as const, item }));
}

export function getNavForRole(
  role: UserRole,
  options?: {
    canAccessCpaOffers?: boolean;
    canAccessAutoresponder?: boolean;
    staffMenuAccess?: string[];
  },
): AdminNavEntry[] {
  switch (role) {
    case "ADMIN":
      return ADMIN_NAV;
    case "PLATFORM_MANAGER": {
      const allowed = new Set(options?.staffMenuAccess ?? []);
      const legacyChildren = ADMIN_LEGACY_NAV.filter((item) => {
        if (item.href === STAFF_USERS_PATH) return false;
        return allowed.has(item.href);
      });
      const entries: AdminNavEntry[] = [
        { kind: "item", item: { label: "Dashboard", href: "/admin", icon: LayoutDashboard } },
      ];
      if (legacyChildren.length > 0) {
        entries.push({ kind: "section", label: "OLD" });
        entries.push({
          kind: "item",
          item: {
            label: "Old Menu",
            href: "/admin/old-menu",
            icon: Archive,
            children: legacyChildren,
          },
        });
      }
      return entries;
    }
    case "ADVERTISER": {
      let items = ADVERTISER_NAV;
      if (options?.canAccessCpaOffers === false) {
        items = items.filter((item) => item.href !== "/advertiser/cpa-offers");
      }
      if (options?.canAccessAutoresponder === false) {
        items = items.filter((item) => item.href !== "/advertiser/email");
      }
      return asNavEntries(items);
    }
    case "PUBLISHER":
      return asNavEntries(PUBLISHER_NAV);
    default:
      return [];
  }
}
