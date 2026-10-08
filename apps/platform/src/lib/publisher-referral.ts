import {
  isPublisherReferralEligible,
  publisherReferralCommission,
  REFERRAL_CPA_REFERENCE,
  REFERRAL_DIGITAL_REFERENCE,
  REFERRAL_DIGITAL_REVERSAL_REFERENCE,
} from "@/lib/referral";

export type ReferralDigitalSource = {
  publisherId: string;
  kind: "sale" | "reversal";
  /** The sale event this entry belongs to; null when a refund cannot be matched to its sale. */
  saleEventId: string | null;
  amount: number;
  createdAt: Date;
};

export type ReferralCpaSource = {
  publisherId: string;
  conversionId: string;
  payout: number;
  createdAt: Date;
  offerName?: string;
};

export type PlannedReferralEntry = {
  referrerId: string;
  type: "CREDIT" | "DEBIT";
  referenceType: string;
  referenceId: string;
  amount: number;
  description: string;
};

export function referralEntryKey(referenceType: string, referenceId: string) {
  return `${referenceType}:${referenceId}`;
}

/**
 * Works out which referral ledger entries are still missing. `existing` maps
 * `referralEntryKey` to the amount already posted, so re-running is a no-op.
 */
export function planPublisherReferralEntries(input: {
  referrerOf: Map<string, string>;
  nameOf: Map<string, string>;
  digital: ReferralDigitalSource[];
  cpa: ReferralCpaSource[];
  existing: Map<string, number>;
}): PlannedReferralEntry[] {
  const posted = new Map(input.existing);
  const planned: PlannedReferralEntry[] = [];
  const nameOf = (id: string) => input.nameOf.get(id) ?? "a referred affiliate";

  for (const source of input.digital) {
    if (source.kind !== "sale" || !source.saleEventId) continue;
    const referrerId = input.referrerOf.get(source.publisherId);
    if (!referrerId || !isPublisherReferralEligible(source.createdAt)) continue;
    const key = referralEntryKey(REFERRAL_DIGITAL_REFERENCE, source.saleEventId);
    if (posted.has(key)) continue;
    const amount = publisherReferralCommission("digital", source.amount);
    if (amount <= 0) continue;
    posted.set(key, amount);
    planned.push({
      referrerId,
      type: "CREDIT",
      referenceType: REFERRAL_DIGITAL_REFERENCE,
      referenceId: source.saleEventId,
      amount,
      description: `10% referral commission on Digital Product sale by ${nameOf(source.publisherId)}`,
    });
  }

  for (const source of input.digital) {
    if (source.kind !== "reversal" || !source.saleEventId) continue;
    const referrerId = input.referrerOf.get(source.publisherId);
    if (!referrerId) continue;
    const credited = posted.get(referralEntryKey(REFERRAL_DIGITAL_REFERENCE, source.saleEventId));
    const reversalKey = referralEntryKey(REFERRAL_DIGITAL_REVERSAL_REFERENCE, source.saleEventId);
    if (!credited || posted.has(reversalKey)) continue;
    posted.set(reversalKey, credited);
    planned.push({
      referrerId,
      type: "DEBIT",
      referenceType: REFERRAL_DIGITAL_REVERSAL_REFERENCE,
      referenceId: source.saleEventId,
      amount: credited,
      description: `Referral commission reversed: Digital Product sale by ${nameOf(source.publisherId)} was refunded`,
    });
  }

  for (const source of input.cpa) {
    const referrerId = input.referrerOf.get(source.publisherId);
    if (!referrerId || !isPublisherReferralEligible(source.createdAt)) continue;
    const key = referralEntryKey(REFERRAL_CPA_REFERENCE, source.conversionId);
    if (posted.has(key)) continue;
    const amount = publisherReferralCommission("cpa", source.payout);
    if (amount <= 0) continue;
    posted.set(key, amount);
    const offer = source.offerName ? ` (${source.offerName})` : "";
    planned.push({
      referrerId,
      type: "CREDIT",
      referenceType: REFERRAL_CPA_REFERENCE,
      referenceId: source.conversionId,
      amount,
      description: `5% referral commission on CPA conversion${offer} by ${nameOf(source.publisherId)}`,
    });
  }

  return planned;
}

/** Signed amount of a referral ledger entry (reversals are negative). */
export function signedReferralAmount(entry: { type: string; amount: number }) {
  return entry.type === "DEBIT" ? -entry.amount : entry.amount;
}
