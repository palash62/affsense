import { describe, expect, it } from "vitest";
import {
  filterAdminQuickActionLinks,
  shouldShowAdminQuickActions,
} from "@/lib/header-quick-actions";

describe("shouldShowAdminQuickActions", () => {
  it("shows quick actions for admin portal roles", () => {
    expect(shouldShowAdminQuickActions("ADMIN")).toBe(true);
    expect(shouldShowAdminQuickActions("PLATFORM_MANAGER")).toBe(true);
    expect(shouldShowAdminQuickActions("ADVERTISER")).toBe(false);
    expect(shouldShowAdminQuickActions("PUBLISHER")).toBe(false);
  });
});

describe("filterAdminQuickActionLinks", () => {
  const links = [
    { label: "Create Campaign", href: "/admin/campaigns" },
    { label: "Add Advertiser", href: "/admin/advertisers" },
    { label: "Add Publisher", href: "/admin/publishers" },
    { label: "Review Leads", href: "/admin/leads" },
  ];

  it("keeps all links for admins", () => {
    expect(filterAdminQuickActionLinks(links, "ADMIN", [])).toEqual(links);
  });

  it("filters links for managers by staffMenuAccess", () => {
    const filtered = filterAdminQuickActionLinks(links, "PLATFORM_MANAGER", [
      "/admin/publishers",
      "/admin/leads",
    ]);
    expect(filtered.map((l) => l.href)).toEqual([
      "/admin/publishers",
      "/admin/leads",
    ]);
  });
});
