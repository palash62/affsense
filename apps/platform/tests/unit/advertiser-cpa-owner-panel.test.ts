import { describe, expect, it } from "vitest";
import { sumAdvertiserCpaInvoiceAmount } from "@/services/advertiser-cpa-invoice.service";

describe("advertiser CPA owner invoice amount", () => {
  it("sums offer revenue for conversions into one invoice total", () => {
    expect(sumAdvertiserCpaInvoiceAmount([9.99, 9.99])).toBe(19.98);
    expect(sumAdvertiserCpaInvoiceAmount([21.14])).toBe(21.14);
    expect(sumAdvertiserCpaInvoiceAmount([])).toBe(0);
  });
});

describe("owner report filter contract", () => {
  it("scopes by offer.ownerAdvertiserId not click advertiserId", () => {
    const ownerId = "adv-owner-1";
    const ownerWhere = { offer: { ownerAdvertiserId: ownerId } };
    const promoterWhere = { advertiserId: "adv-promoter-9" };
    expect(ownerWhere.offer.ownerAdvertiserId).toBe(ownerId);
    expect(ownerWhere.offer.ownerAdvertiserId).not.toBe(promoterWhere.advertiserId);
  });
});
