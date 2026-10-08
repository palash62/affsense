import { describe, expect, it } from "vitest";
import {
  buildPublisherReferralUrl,
  isPublisherReferralEligible,
  PUBLISHER_REFERRAL_START_AT,
  publisherReferralCommission,
  REFERRAL_CPA_REFERENCE,
  REFERRAL_DIGITAL_REFERENCE,
  REFERRAL_DIGITAL_REVERSAL_REFERENCE,
} from "@/lib/referral";
import { planPublisherReferralEntries, referralEntryKey } from "@/lib/publisher-referral";

const after = new Date(PUBLISHER_REFERRAL_START_AT.getTime() + 60_000);
const before = new Date(PUBLISHER_REFERRAL_START_AT.getTime() - 60_000);

const base = {
  referrerOf: new Map([["child", "parent"]]),
  nameOf: new Map([["child", "Child Affiliate"]]),
};

describe("publisherReferralCommission", () => {
  it("pays 10% on digital and 5% on CPA", () => {
    expect(publisherReferralCommission("digital", 20)).toBe(2);
    expect(publisherReferralCommission("cpa", 8)).toBe(0.4);
  });

  it("rounds to cents and ignores non-positive amounts", () => {
    expect(publisherReferralCommission("digital", 12.345)).toBe(1.23);
    expect(publisherReferralCommission("cpa", 3.33)).toBe(0.17);
    expect(publisherReferralCommission("cpa", 0)).toBe(0);
    expect(publisherReferralCommission("digital", -5)).toBe(0);
  });

  it("only counts earnings from the program start", () => {
    expect(isPublisherReferralEligible(after)).toBe(true);
    expect(isPublisherReferralEligible(PUBLISHER_REFERRAL_START_AT)).toBe(true);
    expect(isPublisherReferralEligible(before)).toBe(false);
  });

  it("builds a sign-up link", () => {
    expect(buildPublisherReferralUrl("https://affsense.com", "AB12CD")).toBe(
      "https://affsense.com/register?referral_by=AB12CD",
    );
  });
});

describe("planPublisherReferralEntries", () => {
  it("credits digital sales and CPA conversions for the referrer", () => {
    const planned = planPublisherReferralEntries({
      ...base,
      digital: [{ publisherId: "child", kind: "sale", saleEventId: "ev1", amount: 20, createdAt: after }],
      cpa: [{ publisherId: "child", conversionId: "cv1", payout: 8, createdAt: after }],
      existing: new Map(),
    });
    expect(planned).toEqual([
      expect.objectContaining({
        referrerId: "parent",
        type: "CREDIT",
        referenceType: REFERRAL_DIGITAL_REFERENCE,
        referenceId: "ev1",
        amount: 2,
      }),
      expect.objectContaining({
        referrerId: "parent",
        type: "CREDIT",
        referenceType: REFERRAL_CPA_REFERENCE,
        referenceId: "cv1",
        amount: 0.4,
      }),
    ]);
  });

  it("skips earnings before the start, unreferred affiliates and already-posted entries", () => {
    const planned = planPublisherReferralEntries({
      ...base,
      digital: [
        { publisherId: "child", kind: "sale", saleEventId: "old", amount: 50, createdAt: before },
        { publisherId: "stranger", kind: "sale", saleEventId: "ev2", amount: 50, createdAt: after },
        { publisherId: "child", kind: "sale", saleEventId: "ev1", amount: 20, createdAt: after },
      ],
      cpa: [{ publisherId: "child", conversionId: "cv1", payout: 8, createdAt: after }],
      existing: new Map([
        [referralEntryKey(REFERRAL_DIGITAL_REFERENCE, "ev1"), 2],
        [referralEntryKey(REFERRAL_CPA_REFERENCE, "cv1"), 0.4],
      ]),
    });
    expect(planned).toEqual([]);
  });

  it("reverses a refunded sale once, for the credited amount", () => {
    const planned = planPublisherReferralEntries({
      ...base,
      digital: [
        { publisherId: "child", kind: "sale", saleEventId: "ev1", amount: 20, createdAt: after },
        { publisherId: "child", kind: "reversal", saleEventId: "ev1", amount: 20, createdAt: after },
        { publisherId: "child", kind: "reversal", saleEventId: "ev1", amount: 20, createdAt: after },
        { publisherId: "child", kind: "reversal", saleEventId: null, amount: 9, createdAt: after },
      ],
      cpa: [],
      existing: new Map(),
    });
    expect(planned.map((entry) => [entry.type, entry.referenceType, entry.amount])).toEqual([
      ["CREDIT", REFERRAL_DIGITAL_REFERENCE, 2],
      ["DEBIT", REFERRAL_DIGITAL_REVERSAL_REFERENCE, 2],
    ]);
  });

  it("does not reverse a sale that never paid a referral commission", () => {
    const planned = planPublisherReferralEntries({
      ...base,
      digital: [{ publisherId: "child", kind: "reversal", saleEventId: "old", amount: 20, createdAt: after }],
      cpa: [],
      existing: new Map(),
    });
    expect(planned).toEqual([]);
  });
});
