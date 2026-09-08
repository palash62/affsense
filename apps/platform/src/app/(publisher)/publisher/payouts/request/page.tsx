export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPublisherPayoutRequestEligibility } from "@/services/payout.service";
import { loadAffiliateInvoicingConfig } from "@/services/affiliate-invoicing-settings.service";
import { getWalletBalance, getPlatformSettings } from "@/services/wallet.service";
import { RoleHero } from "@/components/layout/role-hero";
import { PublisherInfoBanner } from "@/components/publisher/publisher-info-banner";
import { PublisherPayoutRequestForm } from "@/components/publisher/publisher-payout-request-form";

export default async function RequestPayoutPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;

  // Invoicing replaces self-service withdrawals for affiliates.
  const invoicing = await loadAffiliateInvoicingConfig();
  if (invoicing.enabled) redirect("/publisher/invoices");

  const [balance, settings, payoutEligibility] = await Promise.all([
    getWalletBalance(userId),
    getPlatformSettings(),
    getPublisherPayoutRequestEligibility(userId),
  ]);

  const availableBalance = balance?.availableBalance ?? 0;

  return (
    <div className="space-y-6">
      <RoleHero
        eyebrow="Publisher Portal"
        title="Request Payout"
        description="Withdraw your available earnings to your preferred payment method."
      />

      <PublisherInfoBanner>
        Payouts are reviewed by our team before processing. You can submit one payout request per
        week. Ensure your payment details are up to date and your balance meets the minimum
        withdrawal amount.
      </PublisherInfoBanner>

      <PublisherPayoutRequestForm
        availableBalance={availableBalance}
        minPayoutSettings={{
          wise: settings.minPayoutWise,
          bankTransfer: settings.minPayoutBankTransfer,
          stripeConnect: settings.minPayoutStripeConnect,
        }}
        payoutEligibility={{
          canRequest: payoutEligibility.canRequest,
          lastRequestAt: payoutEligibility.lastRequestAt?.toISOString() ?? null,
          nextAllowedAt: payoutEligibility.nextAllowedAt?.toISOString() ?? null,
        }}
      />
    </div>
  );
}
