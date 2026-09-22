import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canAdvertiserAccessCpaOffers } from "@/lib/cpa-offers-access";
import { AdvertiserCpaPayoutRequestForm } from "@/components/advertiser/advertiser-cpa-payout-request-form";
import { RoleHero } from "@/components/layout/role-hero";
import { getCpaWalletBalances } from "@/services/cpa-wallet.service";
import { getPlatformSettings } from "@/services/wallet.service";

export const dynamic = "force-dynamic";

export default async function AdvertiserCpaWalletWithdrawPage() {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADVERTISER") {
    redirect("/login");
  }

  if (!canAdvertiserAccessCpaOffers(session.user.email)) {
    redirect("/advertiser/cpa-offers");
  }

  const [balances, settings] = await Promise.all([
    getCpaWalletBalances(session.user.id),
    getPlatformSettings(),
  ]);

  return (
    <div className="space-y-6">
      <RoleHero
        eyebrow="CPA Offers"
        title="Request CPA Payout"
        description="Withdraw your available CPA wallet balance to your preferred payment method."
      />

      <AdvertiserCpaPayoutRequestForm
        availableBalance={balances.availableBalance}
        minWithdrawAmount={settings.minAdvertiserWithdrawAmount}
      />
    </div>
  );
}
