import { PageHeader } from "@/components/layout/page-header";
import { PublisherCpaOffersList } from "@/components/publisher/cpa-offers/publisher-cpa-offers-list";

export default function Page() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="CPA Offers"
        description="Browse active CPA offers and copy your tracked affiliate links."
        breadcrumbs={[
          { label: "Publisher", href: "/publisher" },
          { label: "CPA Offers" },
        ]}
      />
      <PublisherCpaOffersList />
    </div>
  );
}
