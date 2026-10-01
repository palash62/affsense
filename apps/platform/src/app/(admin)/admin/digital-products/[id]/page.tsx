import { isAdminPortalRole } from "@/lib/admin-portal";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminDigitalProductDetailPage } from "@/components/admin/digital-products/admin-digital-product-detail-page";
import { getDigitalProductById } from "@/services/digital-product.service";

export const dynamic = "force-dynamic";

export default async function DigitalProductDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  const { id } = await params;
  let product;
  try {
    product = await getDigitalProductById(id);
  } catch {
    notFound();
  }

  return <AdminDigitalProductDetailPage product={product} />;
}
