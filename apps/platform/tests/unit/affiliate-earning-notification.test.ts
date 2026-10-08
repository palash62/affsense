import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  sendEmail: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/services/email.service", () => ({
  sendEmail: mocks.sendEmail,
  getAdminAlertEmail: vi.fn(),
}));
vi.mock("@/services/notification.service", () => ({ createNotification: mocks.createNotification }));
vi.mock("@/services/smtp-settings.service", () => ({
  getResolvedEmailConfig: async () => ({ appUrl: "https://affsense.com" }),
}));

import { buildAffiliateEarningNotification } from "@/lib/affiliate-earning-notification";
import { notifyAffiliateEarning } from "@/services/notify.service";

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("buildAffiliateEarningNotification", () => {
  it("builds copy and links for each source", () => {
    expect(buildAffiliateEarningNotification("digital", 12.5, "AI Prompt Vault")).toMatchObject({
      title: "New sale: you earned $12.50",
      message: "Your Digital Product sale of AI Prompt Vault earned $12.50 commission.",
      actionPath: "/publisher/marketplace/report-log",
      notificationType: "affiliate.sale.digital",
    });
    expect(buildAffiliateEarningNotification("cpa", 8, "Survey Offer")).toMatchObject({
      title: "New CPA conversion: $8.00",
      actionPath: "/publisher/cpa-offers/report-log",
      notificationType: "affiliate.sale.cpa",
    });
    expect(buildAffiliateEarningNotification("offerwall", 1.2)).toMatchObject({
      message: "You earned $1.20 on an Offer Wall conversion.",
      actionPath: "/publisher/offer-wall/report",
      notificationType: "affiliate.sale.offerwall",
    });
    expect(buildAffiliateEarningNotification("referral", 2, "Ravi's Digital Product sale")).toMatchObject({
      title: "Referral commission: $2.00",
      actionPath: "/publisher/referrals",
      notificationType: "affiliate.referral.commission",
    });
  });

  it("skips zero, negative and invalid amounts", () => {
    expect(buildAffiliateEarningNotification("digital", 0)).toBeNull();
    expect(buildAffiliateEarningNotification("cpa", -3)).toBeNull();
    expect(buildAffiliateEarningNotification("offerwall", Number.NaN)).toBeNull();
  });
});

describe("notifyAffiliateEarning", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
    mocks.sendEmail.mockReset().mockResolvedValue({ ok: true });
    mocks.createNotification.mockReset().mockResolvedValue(undefined);
  });

  it("emails an active affiliate and creates an in-app notification", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "p1",
      email: "aff@example.com",
      name: "Aff",
      role: "PUBLISHER",
      status: "ACTIVE",
    });
    notifyAffiliateEarning("p1", { source: "digital", amount: 10, label: "Course" });
    await flush();
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "aff@example.com", subject: expect.any(String) }),
    );
    expect(mocks.createNotification).toHaveBeenCalledWith(
      "p1",
      "affiliate.sale.digital",
      "New sale: you earned $10.00",
      expect.stringContaining("Course"),
    );
  });

  it("does nothing for non-publishers, inactive users or zero amounts", async () => {
    mocks.findUnique.mockResolvedValueOnce({ id: "a1", email: "a@x.com", name: "A", role: "ADVERTISER", status: "ACTIVE" });
    notifyAffiliateEarning("a1", { source: "cpa", amount: 5 });
    mocks.findUnique.mockResolvedValueOnce({ id: "p2", email: "p@x.com", name: "P", role: "PUBLISHER", status: "SUSPENDED" });
    notifyAffiliateEarning("p2", { source: "cpa", amount: 5 });
    notifyAffiliateEarning("p3", { source: "cpa", amount: 0 });
    await flush();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.findUnique).toHaveBeenCalledTimes(2);
  });

  it("never throws when the email fails", async () => {
    mocks.findUnique.mockResolvedValue({ id: "p1", email: "a@x.com", name: "A", role: "PUBLISHER", status: "ACTIVE" });
    mocks.sendEmail.mockRejectedValue(new Error("smtp down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => notifyAffiliateEarning("p1", { source: "offerwall", amount: 1 })).not.toThrow();
    await flush();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
