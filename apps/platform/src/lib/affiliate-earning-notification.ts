export type AffiliateEarningSource = "digital" | "cpa" | "offerwall" | "referral";

export type AffiliateEarningNotification = {
  title: string;
  message: string;
  actionPath: string;
  actionLabel: string;
  notificationType: string;
};

function usd(amount: number) {
  return `$${amount.toFixed(2)}`;
}

/** Email and in-app copy for one affiliate earning; null when there is nothing to announce. */
export function buildAffiliateEarningNotification(
  source: AffiliateEarningSource,
  amount: number,
  label?: string | null,
): AffiliateEarningNotification | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const money = usd(amount);
  const name = label?.trim();

  switch (source) {
    case "digital":
      return {
        title: `New sale: you earned ${money}`,
        message: `Your Digital Product sale${name ? ` of ${name}` : ""} earned ${money} commission.`,
        actionPath: "/publisher/marketplace/report-log",
        actionLabel: "View sale",
        notificationType: "affiliate.sale.digital",
      };
    case "cpa":
      return {
        title: `New CPA conversion: ${money}`,
        message: `You earned ${money} on a CPA Offer conversion${name ? ` on ${name}` : ""}.`,
        actionPath: "/publisher/cpa-offers/report-log",
        actionLabel: "View conversion",
        notificationType: "affiliate.sale.cpa",
      };
    case "offerwall":
      return {
        title: `Offer Wall conversion: ${money}`,
        message: `You earned ${money} on an Offer Wall conversion${name ? ` (${name})` : ""}.`,
        actionPath: "/publisher/offer-wall/report",
        actionLabel: "View report",
        notificationType: "affiliate.sale.offerwall",
      };
    case "referral":
      return {
        title: `Referral commission: ${money}`,
        message: `You earned a ${money} referral commission${name ? ` from ${name}` : ""}. It will be added to your next invoice.`,
        actionPath: "/publisher/referrals",
        actionLabel: "View referrals",
        notificationType: "affiliate.referral.commission",
      };
  }
}
