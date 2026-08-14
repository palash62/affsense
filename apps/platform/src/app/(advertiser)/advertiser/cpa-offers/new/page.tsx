import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canAdvertiserAccessCpaOffers } from "@/lib/cpa-offers-access";
import { prisma } from "@/lib/prisma";
import { CpaOfferEditor } from "@/components/cpa/cpa-offer-editor";

export const dynamic = "force-dynamic";

export default async function AdvertiserCpaOfferNewPage() {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADVERTISER") {
    redirect("/login");
  }
  if (!canAdvertiserAccessCpaOffers(session.user.email)) {
    redirect("/advertiser");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      advertiserProfile: { select: { company: true } },
    },
  });

  return (
    <CpaOfferEditor
      role="ADVERTISER"
      mode="create"
      advertiserLabelDefault={user?.advertiserProfile?.company || user?.name || "Advertiser"}
    />
  );
}
