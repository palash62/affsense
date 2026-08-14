import { isAdminPortalRole } from "@/lib/admin-portal";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CpaOfferEditor } from "@/components/cpa/cpa-offer-editor";
import { getCpaOfferById } from "@/services/cpa-offer.service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminCpaOfferEditPage({ params }: PageProps) {
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

  return <CpaOfferEditor role="ADMIN" mode="edit" offer={offer} />;
}
