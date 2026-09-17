import { PageHeader } from "@/components/layout/page-header";
import { PublisherOfferWallList } from "@/components/publisher/offer-wall/publisher-offer-wall-list";

export default function Page() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Offer Wall"
        description="Preview OGAds offer wall inventory for affiliates."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Offer Wall" },
        ]}
      />
      <PublisherOfferWallList
        apiPath="/api/v1/admin/offer-wall"
        unconfiguredHint="Add the OGAds Offer API key under Platform Settings → Offer Wall."
        settingsHref="/admin/settings?section=offer-wall"
        trackClicks={false}
      />
    </div>
  );
}
