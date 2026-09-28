import { describe, expect, it } from "vitest";
import { selectCpaPublisherPayout } from "@cpl/shared";
import {
  applyDigitalCommissionPlan,
  applyDigitalCommissionSnapshot,
  buildDigitalProductCommissionLookup,
  type DigitalCommissionPlanRates,
} from "@/lib/digital-product-commission";
import { findCommissionPlanMemberConflicts } from "@/services/commission-plan.service";

const catalog = buildDigitalProductCommissionLookup({
  products: [
    {
      id: "prod-1",
      name: "Mastery Course",
      salesPageUrl: "https://example.com/sales",
      price: 20,
      frontEndCommission: 50,
    },
  ],
  upsells: [
    { id: "up-1", name: "OTO 1", pageSlug: "oto1", price: 100, commissionPct: 40, productId: "prod-1" },
    { id: "up-2", name: "OTO 2", pageSlug: "oto2", price: 200, commissionPct: 30, productId: "prod-1" },
  ],
});

const plan: DigitalCommissionPlanRates = {
  planId: "plan-1",
  isActive: true,
  frontEndCommission: 75,
  upsellRates: new Map([["up-1", 60]]),
};

describe("applyDigitalCommissionPlan", () => {
  it("uses the plan front-end rate for a publisher in the plan", () => {
    const resolved = applyDigitalCommissionPlan(catalog.resolve("sales", 20), plan, 20);
    expect(resolved.matched).toBe("front_end");
    expect(resolved.rate).toBe(0.75);
    expect(resolved.commission).toBe(15);
    expect(resolved.planId).toBe("plan-1");
  });

  it("uses the plan upsell rate when the plan sets one", () => {
    const resolved = applyDigitalCommissionPlan(catalog.resolve("oto1", 100), plan, 100);
    expect(resolved.upsellId).toBe("up-1");
    expect(resolved.commission).toBe(60);
    expect(resolved.planId).toBe("plan-1");
  });

  it("keeps the upsell default when the plan has no rate for it", () => {
    const resolved = applyDigitalCommissionPlan(catalog.resolve("oto2", 200), plan, 200);
    expect(resolved.upsellId).toBe("up-2");
    expect(resolved.commission).toBe(60);
    expect(resolved.rate).toBe(0.3);
    expect(resolved.planId).toBeUndefined();
  });

  it("keeps product rates for a publisher not in a plan", () => {
    const resolved = applyDigitalCommissionPlan(catalog.resolve("sales", 20), null, 20);
    expect(resolved.commission).toBe(10);
    expect(resolved.planId).toBeUndefined();
  });

  it("ignores an inactive plan", () => {
    const resolved = applyDigitalCommissionPlan(
      catalog.resolve("sales", 20),
      { ...plan, isActive: false },
      20,
    );
    expect(resolved.commission).toBe(10);
  });

  it("does not apply a plan to unmatched fallback sales", () => {
    const resolved = applyDigitalCommissionPlan(catalog.resolve("unknown", 999), plan, 999);
    expect(resolved.matched).toBe("fallback");
    expect(resolved.planId).toBeUndefined();
  });
});

describe("applyDigitalCommissionSnapshot", () => {
  it("prefers the commission saved at sale time", () => {
    const resolved = applyDigitalCommissionSnapshot(catalog.resolve("sales", 20), {
      commissionAmount: "15.00",
      commissionRate: "75.00",
      digitalCommissionPlanId: "plan-1",
    });
    expect(resolved.commission).toBe(15);
    expect(resolved.rate).toBe(0.75);
    expect(resolved.planId).toBe("plan-1");
  });

  it("recalculates old events without a snapshot", () => {
    const resolved = applyDigitalCommissionSnapshot(catalog.resolve("sales", 20), {
      commissionAmount: null,
      commissionRate: null,
    });
    expect(resolved.commission).toBe(10);
  });
});

describe("findCommissionPlanMemberConflicts", () => {
  const existing = [
    { publisherId: "pub-a", planId: "plan-1" },
    { publisherId: "pub-b", planId: "plan-2" },
  ];

  it("flags affiliates already in another plan for the product", () => {
    expect(findCommissionPlanMemberConflicts(existing, "plan-1", ["pub-a", "pub-b", "pub-c"])).toEqual([
      "pub-b",
    ]);
  });

  it("flags all existing members when creating a new plan", () => {
    expect(findCommissionPlanMemberConflicts(existing, null, ["pub-a", "pub-c"])).toEqual(["pub-a"]);
  });

  it("allows re-saving a plan with its own members", () => {
    expect(findCommissionPlanMemberConflicts(existing, "plan-2", ["pub-b"])).toEqual([]);
  });
});

describe("selectCpaPublisherPayout", () => {
  it("uses the active plan payout", () => {
    expect(selectCpaPublisherPayout(10, { payout: "25.50", isActive: true })).toEqual({
      payout: 25.5,
      fromPlan: true,
    });
  });

  it("falls back to the offer payout without a plan", () => {
    expect(selectCpaPublisherPayout(10, null)).toEqual({ payout: 10, fromPlan: false });
  });

  it("falls back to the offer payout when the plan is inactive", () => {
    expect(selectCpaPublisherPayout(10, { payout: 25, isActive: false })).toEqual({
      payout: 10,
      fromPlan: false,
    });
  });
});
