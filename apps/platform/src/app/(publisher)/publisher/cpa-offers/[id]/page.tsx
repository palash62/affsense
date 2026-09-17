export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPublisherCpaOfferById } from "@/services/cpa-offer.service";
import { PageHeader } from "@/components/layout/page-header";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={offer.name}
        description={`OFFER #${offer.id}`}
        breadcrumbs={[
          { label: "Publisher", href: "/publisher" },
          { label: "CPA Offers", href: "/publisher/cpa-offers" },
          { label: offer.name },
        ]}
      />
      <PublisherCpaOfferDetailPage offer={offer} publisherId={session.user.id} />
    </div>
  );
}
