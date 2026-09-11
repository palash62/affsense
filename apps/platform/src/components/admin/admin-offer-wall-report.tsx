"use client";

import { OfferWallReportPanel } from "@/components/offer-wall/offer-wall-report-panel";

export function AdminOfferWallReport() {
  return (
    <OfferWallReportPanel
      apiPath="/api/v1/admin/offer-wall/report"
      eyebrow="Offer Wall"
      title="Report"
      description="Affiliate Offer Wall performance — clicks, conversions, and payouts."
      showPublisherFilter
      showNetworkPayout
    />
  );
}
