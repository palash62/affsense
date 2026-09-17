export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPublisherDigitalProduct } from "@/services/digital-product.service";
import { PageHeader } from "@/components/layout/page-header";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={product.shortDescription || undefined}
        badge="Active"
        breadcrumbs={[
          { label: "Publisher", href: "/publisher" },
          { label: "Marketplace", href: "/publisher/marketplace" },
          { label: product.name },
        ]}
      />
      <PublisherProductViewPage product={product} publisherId={session.user.id} />
    </div>
  );
}
