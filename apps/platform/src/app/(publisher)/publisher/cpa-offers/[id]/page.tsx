export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPublisherCpaOfferById } from "@/services/cpa-offer.service";
import { PublisherCpaOfferDetailPage } from "@/components/publisher/cpa-offers/publisher-cpa-offer-detail-page";

export default async function PublisherCpaOfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "PUBLISHER") redirect("/");

  const { id } = await params;
  const offer = await getPublisherCpaOfferById(session.user.id, id);
  if (!offer) notFound();

  return <PublisherCpaOfferDetailPage offer={offer} publisherId={session.user.id} />;
}
