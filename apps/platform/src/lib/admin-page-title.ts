/**
 * Resolve admin page title (+ optional header subtitle) from pathname.
 */
export function getAdminPageMeta(
  pathname: string,
  firstName = "Admin",
): { title: string; subtitle?: string } {
  const path = pathname.split("?")[0] || pathname;

  if (path === "/admin" || path === "/admin/") {
    return {
      title: "Dashboard",
      subtitle: `Welcome back, ${firstName}! Here's what's happening today.`,
    };
  }

  if (path === "/admin/digital-products") {
    return {
      title: "Digital Products",
      subtitle: "Manage your digital product offers",
    };
  }

  if (path === "/admin/digital-products/new") {
    return { title: "Add New Digital Product Offer" };
  }

  if (/^\/admin\/digital-products\/[^/]+\/edit$/.test(path)) {
    return { title: "Edit Digital Product Offer" };
  }

  if (path === "/admin/digital-products/categories") {
    return {
      title: "Product Categories",
      subtitle: "Organize digital products by category",
    };
  }

  if (path === "/admin/get-paid-tasks") {
    return {
      title: "Get Paid Tasks",
      subtitle: "Manage member micro-tasks and rewards",
    };
  }

  if (path === "/admin/get-paid-tasks/new") {
    return { title: "Add New Get Paid Task" };
  }

  if (path === "/admin/get-paid-tasks/categories") {
    return {
      title: "Task Categories",
      subtitle: "Organize get paid tasks by category",
    };
  }

  if (path === "/admin/offer-network") {
    return {
      title: "CPA Offers",
      subtitle: "Create and manage CPA offers for the advertiser marketplace",
    };
  }

  if (path === "/admin/offer-network/requests") {
    return {
      title: "Offer Requests",
      subtitle: "Review affiliate requests for private CPA offers",
    };
  }

  if (path === "/admin/cpa-offers/report") {
    return {
      title: "CPA Report",
      subtitle: "Conversion postbacks by offer, advertiser, and affiliate traffic",
    };
  }

  if (path === "/admin/cpa-offers/new") {
    return {
      title: "Add New CPA Offer",
      subtitle: "CPA Offers > Add New CPA Offer",
    };
  }

  if (path.startsWith("/admin/cpa-offers/") && path.endsWith("/edit")) {
    return {
      title: "Edit CPA Offer",
      subtitle: "CPA Offers > Edit CPA Offer",
    };
  }

  if (path === "/admin/publishers") {
    return {
      title: "Affiliates",
      subtitle: "Manage publisher accounts and approvals",
    };
  }

  if (path === "/admin/advertisers") {
    return {
      title: "Advertisers",
      subtitle: "Manage advertiser accounts, wallet balances, and account status",
    };
  }

  if (path === "/admin/users") {
    return {
      title: "Manager",
      subtitle: "Manage platform staff and menu access",
    };
  }

  if (path === "/admin/themes") {
    return {
      title: "Themes",
      subtitle: "Choose a color theme for the platform",
    };
  }

  if (path === "/admin/settings") {
    return {
      title: "Platform Settings",
      subtitle: "Configure global platform options and your admin preferences",
    };
  }

  if (path === "/admin/bulk-email") {
    return {
      title: "Email Campaigns",
      subtitle: "Email one or many active advertisers or publishers from the admin panel",
    };
  }

  if (path === "/admin/referrals") {
    return {
      title: "Referrals",
      subtitle: "See who referred whom and how much referral commission each relationship has earned",
    };
  }

  if (path === "/admin/wallets") {
    return {
      title: "Wallets",
      subtitle: "View wallet balances across all users",
    };
  }

  if (path === "/admin/deposits") {
    return {
      title: "Deposits",
      subtitle: "Approve Wise transfers and review full advertiser deposit history",
    };
  }

  if (path === "/admin/payout-center") {
    return {
      title: "Payouts",
      subtitle: "Approve publisher and referral withdrawals and review payout history",
    };
  }

  if (path === "/admin/support-tickets") {
    return {
      title: "Support Tickets",
      subtitle: "Review and respond to user support requests",
    };
  }

  if (path === "/admin/promotions") {
    return {
      title: "Promotion",
      subtitle:
        "Create tracked UTM links and measure clicks, visits, advertiser signups, and deposit revenue",
    };
  }

  if (path === "/admin/announcements") {
    return {
      title: "Announcements",
      subtitle: "Post updates that appear on advertiser and affiliate dashboards.",
    };
  }

  const exact: Record<string, string> = {
    "/admin/user-directory": "Users",
    "/admin/commissions": "Commissions",
    "/admin/tasks": "Tasks (Quick Earn)",
    "/admin/referral-program": "Referrals",
    "/admin/email-campaigns": "Email Campaigns",
    "/admin/banners": "Banners",
    "/admin/general-settings": "General Settings",
    "/admin/system-logs": "System Logs",
    "/admin/old-menu": "Old Menu",
    "/admin/old-dashboard": "Old Dashboard",
    "/admin/profit": "Profit",
    "/admin/campaigns": "Campaigns",
    "/admin/cpa-offers": "CPA Offers",
    "/admin/cpa-offers/offers": "All Offers",
    "/admin/cpa-offers/report": "CPA Report",
    "/admin/cpa-offers/payouts": "CPA Payouts",
    "/admin/global-postback": "CPA Postback",
    "/admin/leads": "Leads",
    "/admin/fraud": "Fraud Center",
    "/admin/wallets": "Wallets",
    "/admin/deposits": "Deposits",
    "/admin/payouts": "Payouts",
    "/admin/reports": "Reports",
    "/admin/support": "Support",
    "/admin/audit-log": "Audit Log",
    "/admin/funnel-templates": "Funnel Templates",
    "/admin/tutorials": "Tutorials",
    "/admin/notifications": "Notifications",
  };

  if (exact[path]) {
    return { title: exact[path] };
  }

  // Prefix matches for nested legacy/admin routes
  const prefixes: Array<[string, string]> = [
    ["/admin/advertisers/", "Advertisers"],
    ["/admin/publishers/", "Affiliates"],
    ["/admin/campaigns/", "Campaigns"],
    ["/admin/cpa-offers/", "CPA Offers"],
    ["/admin/digital-products/", "Digital Products"],
    ["/admin/get-paid-tasks/", "Get Paid Tasks"],
    ["/admin/funnel-templates/", "Funnel Templates"],
  ];
  for (const [prefix, title] of prefixes) {
    if (path.startsWith(prefix)) return { title };
  }

  const slug = path.replace(/^\/admin\/?/, "").split("/")[0];
  if (!slug) return { title: "Dashboard" };
  const pretty = slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return { title: pretty };
}

export function getAdminRoleLabel(role: string): string {
  if (role === "ADMIN") return "Super Admin";
  if (role === "PLATFORM_MANAGER") return "Platform Manager";
  return role;
}
