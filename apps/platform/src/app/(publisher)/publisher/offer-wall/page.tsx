import { PageHeader } from "@/components/layout/page-header";
import { PublisherOfferWallList } from "@/components/publisher/offer-wall/publisher-offer-wall-list";

export default function Page() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Offer Wall"
        description="Complete a sponsor offer to earn. Payouts credit your wallet."
        breadcrumbs={[
          { label: "Publisher", href: "/publisher" },
          { label: "Offer Wall" },
        ]}
      />
      <PublisherOfferWallList />
    </div>
  );
}
