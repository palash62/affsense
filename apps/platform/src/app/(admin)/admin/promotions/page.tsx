import { Suspense } from "react";
import { PromotionPage } from "@/components/admin/promotions/promotion-page";
import { getAdminPromotionReport, listPromotions } from "@/services/promotion.service";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function AdminPromotionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const from = params.from ? new Date(params.from) : undefined;
  const to = params.to ? new Date(params.to) : undefined;

  const [promotions, report] = await Promise.all([
    listPromotions(),
    getAdminPromotionReport({
      q: params.q,
      from: from && !Number.isNaN(from.getTime()) ? from : undefined,
      to: to && !Number.isNaN(to.getTime()) ? to : undefined,
    }),
  ]);

  return (
    <Suspense fallback={null}>
      <PromotionPage
        promotions={promotions}
        report={report}
        initialQ={params.q}
        initialFrom={params.from}
        initialTo={params.to}
      />
    </Suspense>
  );
}
