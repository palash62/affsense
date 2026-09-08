import {
  PUBLISHER_DIGITAL_PRODUCT_POSTBACK_MACROS,
} from "@cpl/shared";
import { PublisherChannelPostbackForm } from "@/components/publisher/publisher-channel-postback-form";

export function PublisherMarketplacePostbackForm() {
  return (
    <PublisherChannelPostbackForm
      channelLabel="Marketplace"
      eyebrow="Marketplace"
      title="Digital Product Postback"
      description="Receive a server-to-server callback every time one of your digital product sales is recorded."
      banner="When a ClickFunnels sale is attributed to you, we send an HTTP GET to your postback URL with commission macros replaced. Refunds are skipped."
      tip="Add your tracker postback URL and set status to Active. We fire it once per attributed sale event."
      apiBase="/api/v1/publisher/digital-products/postback"
      macros={PUBLISHER_DIGITAL_PRODUCT_POSTBACK_MACROS}
      refLabel="Event"
    />
  );
}
