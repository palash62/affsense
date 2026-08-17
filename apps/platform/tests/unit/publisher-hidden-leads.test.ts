import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/services/wallet.service", () => ({
  processLeadPayment: vi.fn(),
  reverseLeadPayment: vi.fn(),
  getPlatformSettings: vi.fn(),
  PAUSED_REASON_INSUFFICIENT_FUNDS: "Insufficient wallet balance",
}));
vi.mock("@/services/notify.service", () => ({
  notifyGeneric: vi.fn(),
  notifyCampaignPausedForFunds: vi.fn(),
}));
vi.mock("@/modules/fraud", () => ({
  evaluateLead: vi.fn(),
  getFraudConfig: vi.fn(),
  recordDeviceSeen: vi.fn(),
  refreshPublisherQuality: vi.fn(),
  checkCampaignQualityAlert: vi.fn(),
}));
vi.mock("@/modules/autoresponder", () => ({ dispatchAutoresponderEvent: vi.fn() }));
vi.mock("@/modules/email-marketing", () => ({ dispatchLeadEmailAutomations: vi.fn() }));

import {
  buildLeadListWhere,
  PUBLISHER_EXCLUDED_LEAD_STATUSES,
} from "@/services/lead.service";

describe("publisher hidden rejected leads", () => {
  it("excludes REJECTED from publisher lead lists", () => {
    expect(PUBLISHER_EXCLUDED_LEAD_STATUSES).toEqual(["REJECTED"]);
    expect(
      buildLeadListWhere({
        publisherId: "pub-1",
        excludeStatuses: [...PUBLISHER_EXCLUDED_LEAD_STATUSES],
      }),
    ).toMatchObject({
      publisherId: "pub-1",
      status: { notIn: ["REJECTED"] },
    });
  });

  it("keeps an explicit status filter instead of excludeStatuses", () => {
    expect(
      buildLeadListWhere({
        publisherId: "pub-1",
        status: "PENDING",
        excludeStatuses: ["REJECTED"],
      }),
    ).toMatchObject({
      publisherId: "pub-1",
      status: "PENDING",
    });
  });

  it("does not hide rejected leads for admin or advertiser lists", () => {
    expect(buildLeadListWhere({ advertiserId: "adv-1" }).status).toBeUndefined();
  });
});
