import { getTrackingUrl } from "@cpl/shared";
import { isAdminPortalRole } from "@/lib/admin-portal";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminCpaOfferDetailPage } from "@/components/admin/admin-cpa-offer-detail-page";
import { getCpaOfferById } from "@/services/cpa-offer.service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminCpaOfferDetailRoute({ params }: PageProps) {
  const session = await getSession();
  if (!session?.user?.id || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  const { id } = await params;
  let offer;
  try {
    offer = await getCpaOfferById(id);
  } catch {
    notFound();
  }

  return <AdminCpaOfferDetailPage offer={offer} trackingBaseUrl={getTrackingUrl()} />;
}
