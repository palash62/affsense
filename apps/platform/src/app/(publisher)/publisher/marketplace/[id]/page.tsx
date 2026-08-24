export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPublisherDigitalProduct } from "@/services/digital-product.service";
import { PublisherProductViewPage } from "@/components/publisher/marketplace/publisher-product-view-page";

export default async function PublisherMarketplaceProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const product = await getPublisherDigitalProduct(id);
  if (!product) notFound();

  return <PublisherProductViewPage product={product} publisherId={session.user.id} />;
}
