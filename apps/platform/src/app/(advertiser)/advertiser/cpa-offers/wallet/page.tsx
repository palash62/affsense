import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canAdvertiserAccessCpaOffers } from "@/lib/cpa-offers-access";
import { AdvertiserCpaWallet } from "@/components/advertiser/advertiser-cpa-wallet";
import { getCpaWalletSnapshot } from "@/services/cpa-wallet.service";
import { getPlatformSettings } from "@/services/wallet.service";

export const dynamic = "force-dynamic";

export default async function AdvertiserCpaWalletPage() {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADVERTISER") {
    redirect("/login");
  }

  if (!canAdvertiserAccessCpaOffers(session.user.email)) {
    redirect("/advertiser/cpa-offers");
  }

  const [snapshot, settings] = await Promise.all([
    getCpaWalletSnapshot(session.user.id),
    getPlatformSettings(),
  ]);

  return (
    <AdvertiserCpaWallet
      snapshot={snapshot}
      timezone={session.user.timezone}
      minPayoutSettings={{
        wise: settings.minPayoutWise,
        bankTransfer: settings.minPayoutBankTransfer,
        stripeConnect: settings.minPayoutStripeConnect,
      }}
    />
  );
}
