"use client";

import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PromotionKpiRow } from "./promotion-kpi-row";
import { PromotionLinksSection } from "./promotion-links-section";
import { PromotionReportSection } from "./promotion-report-section";
import type { PromotionReport, SerializedPromotion } from "@/services/promotion.service";

export function PromotionPage({
  promotions,
  report,
  initialQ,
  initialFrom,
  initialTo,
}: {
  promotions: SerializedPromotion[];
  report: PromotionReport;
  initialQ?: string;
  initialFrom?: string;
  initialTo?: string;
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Promotions"
        description="Manage promotion links and track performance."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Promotions" },
        ]}
      />

      <PromotionKpiRow stats={report.stats} />
      <PromotionLinksSection initialPromotions={promotions} />
      <Suspense fallback={null}>
        <PromotionReportSection
          initialReport={report}
          initialQ={initialQ}
          initialFrom={initialFrom}
          initialTo={initialTo}
        />
      </Suspense>
    </div>
  );
}
