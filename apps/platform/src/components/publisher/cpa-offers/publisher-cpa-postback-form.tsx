import {
  PUBLISHER_CPA_POSTBACK_MACROS,
} from "@cpl/shared";
import { PublisherChannelPostbackForm } from "@/components/publisher/publisher-channel-postback-form";

export function PublisherCpaPostbackForm() {
  return (
    <PublisherChannelPostbackForm
      channelLabel="CPA"
      eyebrow="CPA Offers"
      title="CPA Postback"
      description="Receive a server-to-server callback every time one of your CPA offers converts."
      banner="When a CPA conversion is recorded for your traffic, we send an HTTP GET to your postback URL with macros replaced."
      tip="Add your tracker postback URL and set status to Active. We fire it once per CPA conversion."
      apiBase="/api/v1/publisher/cpa-offers/postback"
      macros={PUBLISHER_CPA_POSTBACK_MACROS}
      refLabel="Conversion"
    />
  );
}
