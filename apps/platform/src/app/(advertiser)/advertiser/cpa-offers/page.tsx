import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canAdvertiserAccessCpaOffers } from "@/lib/cpa-offers-access";
import { AdvertiserCpaOffersList } from "@/components/advertiser/advertiser-cpa-offers-list";

export const dynamic = "force-dynamic";

export default async function AdvertiserCpaOffersPage() {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADVERTISER") {
    redirect("/login");
  }
  if (!canAdvertiserAccessCpaOffers(session.user.email)) {
    redirect("/advertiser");
  }

  return <AdvertiserCpaOffersList />;
}
