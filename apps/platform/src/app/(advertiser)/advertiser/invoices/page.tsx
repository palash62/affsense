import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canAdvertiserAccessCpaOffers } from "@/lib/cpa-offers-access";
import { AdvertiserCpaInvoicesList } from "@/components/advertiser/advertiser-cpa-invoices-list";

export const dynamic = "force-dynamic";

export default async function AdvertiserInvoicesPage() {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADVERTISER") {
    redirect("/login");
  }
  if (!canAdvertiserAccessCpaOffers(session.user.email)) {
    redirect("/advertiser");
  }

  return <AdvertiserCpaInvoicesList />;
}
