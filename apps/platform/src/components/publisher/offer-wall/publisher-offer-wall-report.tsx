"use client";

import { OfferWallReportPanel } from "@/components/offer-wall/offer-wall-report-panel";

export function PublisherOfferWallReport() {
  return (
    <OfferWallReportPanel
      apiPath="/api/v1/publisher/offer-wall/report"
      eyebrow="Offer Wall"
      title="Report"
      description="Your Offer Wall clicks, conversions, conversion rate, and earnings."
    />
  );
}
