export function isPublisherPortalRole(role: string | null | undefined): boolean {
  return role === "PUBLISHER";
}

export function getPublisherPageMeta(
  pathname: string,
  firstName = "Affiliate",
): { title: string; subtitle?: string } {
  const path = pathname.split("?")[0] || pathname;

  if (path === "/publisher" || path === "/publisher/") {
    return {
      title: "Dashboard",
      subtitle: `Welcome back, ${firstName}! Here's what's happening with your account today.`,
    };
  }

  const exact: Record<string, { title: string; subtitle?: string }> = {
    "/publisher/marketplace": { title: "Marketplace", subtitle: "Browse products to promote" },
    "/publisher/get-paid-tasks": {
      title: "Paid Task",
      subtitle: "Complete tasks and earn rewards",
    },
    "/publisher/offer-wall": {
      title: "Offer Wall",
      subtitle: "Browse offer wall tasks and rewards",
    },
    "/publisher/cpa-offers": { title: "CPA Offers", subtitle: "Promote high-converting CPA offers" },
    "/publisher/promotions": { title: "My Promotions", subtitle: "Manage your active promotions" },
    "/publisher/referrals": { title: "Referrals", subtitle: "Invite affiliates and earn commissions" },
    "/publisher/earnings": {
      title: "Earnings & Payouts",
      subtitle: "Track earnings, request payouts, and view history",
    },
    "/publisher/payouts": { title: "Payouts", subtitle: "Request and track payouts" },
    "/publisher/payouts/request": { title: "Request Payout", subtitle: "Submit a payout request" },
    "/publisher/transactions": { title: "Transactions", subtitle: "View your transaction history" },
    "/publisher/settings": {
      title: "Profile Settings",
      subtitle: "Manage your profile, traffic details, and account security",
    },
    "/publisher/reports/performance": { title: "Performance Reports" },
    "/publisher/reports/offers": { title: "Offer Reports" },
    "/publisher/reports/tasks": { title: "Task Reports" },
    "/publisher/reports/referrals": { title: "Referral Reports" },
    "/publisher/reports/payouts": { title: "Payout Reports" },
    "/publisher/training": { title: "Training Center" },
    "/publisher/help": { title: "Help Center" },
    "/publisher/announcements": {
      title: "Announcements",
      subtitle: "Platform updates and news for affiliates",
    },
    "/publisher/old-menu": { title: "Old Menu" },
    "/publisher/old-dashboard": { title: "Old Dashboard" },
    "/publisher/smart-link": { title: "Smart Link" },
    "/publisher/leads": { title: "Leads" },
    "/publisher/lead-report": { title: "Lead Report" },
    "/publisher/support": { title: "Support" },
    "/publisher/notifications": { title: "Notifications" },
  };

  if (exact[path]) return exact[path];

  const prefixes: Array<[string, string]> = [
    ["/publisher/payouts/", "Payouts"],
    ["/publisher/reports/", "Reports"],
    ["/publisher/earnings/", "Earnings"],
  ];
  for (const [prefix, title] of prefixes) {
    if (path.startsWith(prefix)) return { title };
  }

  const slug = path.replace(/^\/publisher\/?/, "").split("/")[0];
  if (!slug) return { title: "Dashboard" };
  const pretty = slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return { title: pretty };
}
