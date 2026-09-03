import { PublisherOfferWallList } from "@/components/publisher/offer-wall/publisher-offer-wall-list";

export default function Page() {
  return (
    <PublisherOfferWallList
      apiPath="/api/v1/admin/offer-wall"
      unconfiguredHint="Add the OGAds Offer API key under Platform Settings → Offer Wall."
      settingsHref="/admin/settings?section=offer-wall"
    />
  );
}
