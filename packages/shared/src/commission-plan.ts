export type CommissionPlanPayoutSource = {
  payout: number | string | { toString(): string } | null;
  isActive: boolean;
};

function toFiniteNumber(value: CommissionPlanPayoutSource["payout"] | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}

/** Publisher CPA payout: an active commission plan overrides the offer payout. */
export function selectCpaPublisherPayout(
  offerPayout: number | null,
  plan: CommissionPlanPayoutSource | null | undefined,
): { payout: number | null; fromPlan: boolean } {
  if (plan?.isActive) {
    const planPayout = toFiniteNumber(plan.payout);
    if (planPayout != null) return { payout: planPayout, fromPlan: true };
  }
  return { payout: offerPayout, fromPlan: false };
}
