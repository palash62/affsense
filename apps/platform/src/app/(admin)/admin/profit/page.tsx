import { Suspense } from "react";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  getAdminProfitPageData,
  PROFIT_TABLE_PAGE_SIZE,
  resolveProfitPageRange,
} from "@/services/admin-profit.service";
import { getPartnerSettlementByMonth } from "@/services/partner-payment.service";
import { PageHero } from "@/components/admin/page-hero";
import { AdminProfitFilters } from "@/components/admin/admin-profit-filters";
import { AdminPartnerPaymentForm } from "@/components/admin/admin-partner-payment-form";
import {
  AdminPartnerPaymentHistory,
  AdminPartnerSettlementSummary,
  AdminPartnerSettlementTable,
  AdminProfitReportTable,
  AdminProfitSummaryCards,
} from "@/components/admin/admin-profit-page";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    period?: string;
    from?: string;
    to?: string;
    group?: string;
    page?: string;
  }>;
}

export default async function AdminProfitPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const params = await searchParams;
  const range = resolveProfitPageRange(params);
  const [data, partnerSettlement] = await Promise.all([
    getAdminProfitPageData(range.from, range.to, range.groupBy),
    getPartnerSettlementByMonth(range.from, range.to),
  ]);

  const total = data.rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PROFIT_TABLE_PAGE_SIZE));
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page =
    Number.isFinite(requestedPage) && requestedPage >= 1
      ? Math.min(requestedPage, totalPages)
      : 1;
  const start = (page - 1) * PROFIT_TABLE_PAGE_SIZE;
  const pageRows = data.rows.slice(start, start + PROFIT_TABLE_PAGE_SIZE);
  const defaultPeriodMonth = format(range.to, "yyyy-MM");

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Finance"
        title="Profit calculation"
        description="Platform profit split into admin (80%) and partner (20%) shares for the selected period."
      />

      <Suspense fallback={<div className="h-28 animate-pulse rounded-[18px] bg-slate-100" />}>
        <AdminProfitFilters
          period={range.period}
          fromStr={range.fromStr}
          toStr={range.toStr}
          groupBy={range.groupBy}
        />
      </Suspense>

      <AdminProfitSummaryCards summary={data.summary} />

      <AdminPartnerSettlementSummary summary={partnerSettlement.summary} />

      <AdminPartnerPaymentForm defaultPeriodMonth={defaultPeriodMonth} />

      <AdminPartnerSettlementTable rows={partnerSettlement.rows} />

      <AdminPartnerPaymentHistory payments={partnerSettlement.payments} />

      <AdminProfitReportTable
        allRows={data.rows}
        pageRows={pageRows}
        groupBy={range.groupBy}
        fromStr={range.fromStr}
        toStr={range.toStr}
        page={page}
        totalPages={totalPages}
        total={total}
      />
    </div>
  );
}
