"use client";

import { EarningsClicksOverview } from "@/components/publisher/affsense-dashboard/earnings-clicks-overview";
import type { PublisherPerformanceDay } from "@/services/publisher-dashboard.service";

/** Ranges longer than ~3 months are grouped by month so the bars stay readable. */
export function PublisherPerformanceChart({ series }: { series: PublisherPerformanceDay[] }) {
  return <EarningsClicksOverview series={series} period={series.length > 92 ? "year" : "range"} />;
}
