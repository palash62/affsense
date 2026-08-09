import { describe, expect, it } from "vitest";
import { shouldShowAdminQuickActions } from "@/lib/header-quick-actions";

describe("shouldShowAdminQuickActions", () => {
  it("shows quick actions only for admin", () => {
    expect(shouldShowAdminQuickActions("ADMIN")).toBe(true);
    expect(shouldShowAdminQuickActions("PLATFORM_MANAGER")).toBe(false);
    expect(shouldShowAdminQuickActions("ADVERTISER")).toBe(false);
    expect(shouldShowAdminQuickActions("PUBLISHER")).toBe(false);
  });
});
