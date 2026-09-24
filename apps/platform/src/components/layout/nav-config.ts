import type { UserRole } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
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
  FileStack,
  Palette,
  ShieldAlert,
  Mail,
  PlayCircle,
  Store,
  Webhook,
  UserCog,
  Package,
  Percent,
  ListTodo,
  ClipboardList,
  Plus,
  Tags,
  Bell,
  Building2,
  Ticket,
  Share2,
  ShoppingBag,
  Receipt,
  GraduationCap,
  HelpCircle,
  LayoutGrid,
} from "lucide-react";
import { ASSIGNABLE_STAFF_MENU_HREFS, parseStaffMenuAccess, STAFF_USERS_PATH } from "@/lib/admin-portal";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
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
        { label: "Report Log", href: "/admin/cpa-offers/report-log", icon: ScrollText },
        { label: "Advertiser Invoices", href: "/admin/cpa-offers/advertiser-invoices", icon: Receipt },
        { label: "CPA Payouts", href: "/admin/cpa-offers/payouts", icon: Banknote },
      { label: "CPA Postback", href: "/admin/settings?section=cpa-postback", icon: Webhook },
    ],
  },
  { label: "Leads", href: "/admin/leads", icon: FileText },
  { label: "Fraud Center", href: "/admin/fraud", icon: ShieldAlert },
  { label: "Reports", href: "/admin/reports", icon: BarChart3 },
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
        { label: "Advertisers", href: "/admin/advertisers", icon: Building2 },
        { label: "Manager", href: "/admin/users", icon: UserCog },
      ],
    },
  },
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
        { label: "Report", href: "/admin/digital-products/report", icon: BarChart3 },
        { label: "Report Log", href: "/admin/digital-products/report-log", icon: ScrollText },
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
  {
    kind: "item",
    item: {
      label: "Offer Wall",
      href: "/admin/offer-wall",
      icon: LayoutGrid,
      children: [
        { label: "Browse Offers", href: "/admin/offer-wall", icon: LayoutGrid },
        { label: "Report", href: "/admin/offer-wall/report", icon: BarChart3 },
      ],
    },
  },
  { kind: "item", item: { label: "CPA Offers", href: "/admin/offer-network", icon: Store,
      children: [
        { label: "All Offers", href: "/admin/offer-network", icon: Store },
        { label: "Add New Offer", href: "/admin/cpa-offers/new", icon: Plus },
        { label: "Categories", href: "/admin/offer-network/categories", icon: Tags },
        { label: "Offer Requests", href: "/admin/offer-network/requests", icon: ClipboardList },
        { label: "Report", href: "/admin/cpa-offers/report", icon: BarChart3 },
        { label: "Report Log", href: "/admin/cpa-offers/report-log", icon: ScrollText },
        { label: "Advertiser Invoices", href: "/admin/cpa-offers/advertiser-invoices", icon: Receipt },
      ],
    },
  },
  {
    kind: "item",
    item: {
      label: "Commissions",
      href: "/admin/commissions",
      icon: Percent,
      children: [
        { label: "Commissions", href: "/admin/commissions", icon: Percent },
        { label: "Referrals", href: "/admin/referrals", icon: Gift },
      ],
    },
  },
  { kind: "item", item: { label: "Invoices", href: "/admin/invoices", icon: Receipt } },
  {
    kind: "item",
    item: { label: "Support Tickets", href: "/admin/support-tickets", icon: Ticket },
  },

  { kind: "section", label: "MARKETING" },
  {
    kind: "item",
    item: { label: "Email Campaigns", href: "/admin/bulk-email", icon: Mail },
  },
  {
    kind: "item",
    item: { label: "Announcements", href: "/admin/announcements", icon: Bell },
  },

  { kind: "section", label: "SETTINGS" },
  {
    kind: "item",
    item: { label: "Platform Settings", href: "/admin/settings", icon: Settings },
  },
  {
    kind: "item",
    item: { label: "System Logs", href: "/admin/system-logs", icon: ScrollText },
  },
  { kind: "item", item: { label: "Themes", href: "/admin/themes", icon: Palette } },
];

export const ADVERTISER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/advertiser", icon: LayoutDashboard },
  {
    label: "CPA Offers",
    href: "/advertiser/cpa-offers",
    icon: Store,
    children: [
      { label: "My Offers", href: "/advertiser/cpa-offers", icon: Store },
      { label: "Add New Offer", href: "/advertiser/cpa-offers/new", icon: Plus },
      { label: "Report", href: "/advertiser/cpa-offers/report", icon: BarChart3 },
      { label: "Report Log", href: "/advertiser/cpa-offers/report-log", icon: ScrollText },
    ],
  },
  { label: "Wallet", href: "/advertiser/wallet", icon: Wallet },
  { label: "Invoices", href: "/advertiser/invoices", icon: Receipt },
  { label: "Referrals", href: "/advertiser/referal_link", icon: Gift },
  { label: "Support", href: "/advertiser/support", icon: LifeBuoy },
  { label: "Tutorials", href: "/advertiser/tutorials", icon: PlayCircle },
  { label: "Settings", href: "/advertiser/settings", icon: Settings },
];

export const PUBLISHER_LEGACY_NAV: NavItem[] = [
  { label: "Old Dashboard", href: "/publisher/old-dashboard", icon: History },
  { label: "Smart Link", href: "/publisher/smart-link", icon: Link2 },
  { label: "Leads", href: "/publisher/leads", icon: FileText },
  { label: "Lead Report", href: "/publisher/lead-report", icon: BarChart3 },
  { label: "Support", href: "/publisher/support", icon: LifeBuoy },
];

export const PUBLISHER_NAV: AdminNavEntry[] = [
  { kind: "section", label: "EARN" },
  { kind: "item", item: { label: "Dashboard", href: "/publisher", icon: LayoutDashboard } },
  {
    kind: "item",
    item: {
      label: "Marketplace",
      href: "/publisher/marketplace",
      icon: ShoppingBag,
      children: [
        { label: "Digital Product", href: "/publisher/marketplace", icon: Package },
        { label: "Report", href: "/publisher/marketplace/report", icon: BarChart3 },
        { label: "Report Log", href: "/publisher/marketplace/report-log", icon: ScrollText },
        { label: "Postback", href: "/publisher/marketplace/postback", icon: Webhook },
      ],
    },
  },
  {
    kind: "item",
    item: {
      label: "Get Paid Tasks",
      href: "/publisher/get-paid-tasks",
      icon: ListTodo,
      children: [
        { label: "Paid Task", href: "/publisher/get-paid-tasks", icon: ListTodo },
      ],
    },
  },
  {
    kind: "item",
    item: {
      label: "Offer Wall",
      href: "/publisher/offer-wall",
      icon: LayoutGrid,
      children: [
        { label: "Browse Offers", href: "/publisher/offer-wall", icon: LayoutGrid },
        { label: "Report", href: "/publisher/offer-wall/report", icon: BarChart3 },
      ],
    },
  },
  {
    kind: "item",
    item: {
      label: "CPA Offers",
      href: "/publisher/cpa-offers",
      icon: Store,
      children: [
        { label: "Browse Offers", href: "/publisher/cpa-offers", icon: Store },
        { label: "Report", href: "/publisher/cpa-offers/report", icon: BarChart3 },
        { label: "Report Log", href: "/publisher/cpa-offers/report-log", icon: ScrollText },
        { label: "Postback", href: "/publisher/cpa-offers/postback", icon: Webhook },
      ],
    },
  },
  { kind: "item", item: { label: "My Promotions", href: "/publisher/promotions", icon: Percent } },
  { kind: "item", item: { label: "Referrals", href: "/publisher/referrals", icon: Gift } },

  { kind: "section", label: "ACCOUNT" },
  { kind: "item", item: { label: "Earnings & Payouts", href: "/publisher/earnings", icon: Wallet } },
  { kind: "item", item: { label: "Invoices", href: "/publisher/invoices", icon: FileText } },
  { kind: "item", item: { label: "Transactions", href: "/publisher/transactions", icon: Receipt } },
  { kind: "item", item: { label: "Profile Settings", href: "/publisher/settings", icon: Settings } },
  { kind: "item", item: { label: "Support", href: "/publisher/support", icon: LifeBuoy } },

  { kind: "section", label: "REPORTS" },
  {
    kind: "item",
    item: {
      label: "Reports",
      href: "/publisher/reports/commissions",
      icon: BarChart3,
      badge: "NEW",
      children: [
        { label: "Commissions Report", href: "/publisher/reports/commissions", icon: Percent },
        { label: "Performance", href: "/publisher/reports/performance", icon: BarChart3 },
        { label: "Offer Reports", href: "/publisher/reports/offers", icon: Store },
        { label: "Task Reports", href: "/publisher/reports/tasks", icon: ListTodo },
        { label: "Referral Reports", href: "/publisher/reports/referrals", icon: Gift },
        { label: "Payout Reports", href: "/publisher/reports/payouts", icon: Banknote },
      ],
    },
  },

  { kind: "section", label: "RESOURCES" },
  { kind: "item", item: { label: "Training Center", href: "/publisher/training", icon: GraduationCap } },
  { kind: "item", item: { label: "Help Center", href: "/publisher/help", icon: HelpCircle } },
  { kind: "item", item: { label: "Announcements", href: "/publisher/announcements", icon: Bell } },
];

function asNavEntries(items: NavItem[]): AdminNavEntry[] {
  return items.map((item) => ({ kind: "item" as const, item }));
}

export function getAssignableStaffMenuOptions(): { href: string; label: string }[] {
  const options: { href: string; label: string }[] = [];
  const allowed = new Set<string>(ASSIGNABLE_STAFF_MENU_HREFS);

  for (const entry of ADMIN_NAV) {
    if (entry.kind !== "item") continue;
    const { item } = entry;

    if (item.href === "/admin" || item.href === STAFF_USERS_PATH) continue;

    // Users group: expose Affiliates + Advertisers only (never Manager).
    if (item.children?.some((child) => child.href === STAFF_USERS_PATH)) {
      for (const child of item.children) {
        if (child.href === STAFF_USERS_PATH) continue;
        if (!allowed.has(child.href)) continue;
        options.push({ href: child.href, label: child.label });
      }
      continue;
    }

    if (allowed.has(item.href)) {
      options.push({ href: item.href, label: item.label });
    }
  }

  return options;
}

function filterAdminNavForManager(staffMenuAccess: string[]): AdminNavEntry[] {
  const allowed = new Set(parseStaffMenuAccess(staffMenuAccess));
  const entries: AdminNavEntry[] = [
    { kind: "item", item: { label: "Dashboard", href: "/admin", icon: LayoutDashboard } },
  ];

  let pendingSection: AdminNavEntry | null = null;

  for (const entry of ADMIN_NAV) {
    if (entry.kind === "section") {
      pendingSection = entry;
      continue;
    }

    const { item } = entry;
    if (item.href === "/admin") continue;

    // Users group: only Affiliates / Advertisers when granted; never Manager.
    if (item.children?.some((child) => child.href === STAFF_USERS_PATH)) {
      const children = item.children.filter(
        (child) => child.href !== STAFF_USERS_PATH && allowed.has(child.href),
      );
      if (children.length === 0) continue;
      if (pendingSection) {
        entries.push(pendingSection);
        pendingSection = null;
      }
      entries.push({
        kind: "item",
        item: {
          ...item,
          href: children[0]!.href,
          children,
        },
      });
      continue;
    }

    const itemGranted = allowed.has(item.href);
    if (!itemGranted) continue;

    if (pendingSection) {
      entries.push(pendingSection);
      pendingSection = null;
    }

    if (item.children?.length) {
      entries.push({
        kind: "item",
        item: {
          ...item,
          children: item.children.filter(
            (child) =>
              child.href === item.href ||
              child.href.startsWith(`${item.href}/`) ||
              // CPA Offers children include /admin/cpa-offers/* routes
              (item.href === "/admin/offer-network" &&
                (child.href.startsWith("/admin/cpa-offers") ||
                  child.href.startsWith("/admin/offer-network"))) ||
              // Commissions includes referrals
              (item.href === "/admin/commissions" && child.href === "/admin/referrals"),
          ),
        },
      });
    } else {
      entries.push(entry);
    }
  }

  return entries;
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
    case "PLATFORM_MANAGER":
      return filterAdminNavForManager(options?.staffMenuAccess ?? []);
    case "ADVERTISER": {
      let items = ADVERTISER_NAV;
      if (options?.canAccessCpaOffers === false) {
        items = items.filter(
          (item) =>
            item.href !== "/advertiser/cpa-offers" && item.href !== "/advertiser/invoices",
        );
      }
      if (options?.canAccessAutoresponder === false) {
        items = items.filter((item) => item.href !== "/advertiser/email");
      }
      return asNavEntries(items);
    }
    case "PUBLISHER":
      return PUBLISHER_NAV;
    default:
      return [];
  }
}
