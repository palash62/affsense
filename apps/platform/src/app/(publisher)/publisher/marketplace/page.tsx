import { PageHeader } from "@/components/layout/page-header";
import { PublisherMarketplaceList } from "@/components/publisher/marketplace/publisher-marketplace-list";

export default function Page() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Marketplace"
        description="Browse digital products to promote. Copy your tracked link and share it with your audience."
        breadcrumbs={[
          { label: "Publisher", href: "/publisher" },
          { label: "Marketplace" },
        ]}
      />
      <PublisherMarketplaceList />
    </div>
  );
}
