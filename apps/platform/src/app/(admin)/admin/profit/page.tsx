import { isAdminPortalRole } from "@/lib/admin-portal";
import { Suspense } from "react";
import { endOfDay, endOfMonth, parseISO, startOfMonth } from "date-fns";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  getAdminProfitPageData,
  PROFIT_TABLE_PAGE_SIZE,
  resolveProfitPageRange,
} from "@/services/admin-profit.service";
import {
  getPartnerSettlementByMonth,
  currentCalendarMonth,
  type PartnerPaymentRecord,
  type PartnerSettlementRow,
  type PartnerSettlementSummary,
} from "@/services/partner-payment.service";
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

const EMPTY_PARTNER_SETTLEMENT: {
  rows: PartnerSettlementRow[];
  summary: PartnerSettlementSummary;
  payments: PartnerPaymentRecord[];
} = {
  rows: [],
  summary: { owed: 0, paid: 0, remaining: 0 },
  payments: [],
};

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
  if (!session?.user || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  const params = await searchParams;
  const range = resolveProfitPageRange(params);
  const defaultPeriodMonth = currentCalendarMonth();
  const defaultMonthStart = startOfMonth(parseISO(`${defaultPeriodMonth}-01`));
  const defaultMonthEnd = endOfDay(endOfMonth(defaultMonthStart));

  const [profitResult, settlementResult, defaultMonthResult] = await Promise.allSettled([
    getAdminProfitPageData(range.from, range.to, range.groupBy),
    getPartnerSettlementByMonth(range.from, range.to),
    getPartnerSettlementByMonth(defaultMonthStart, defaultMonthEnd),
  ]);

  if (profitResult.status === "rejected") {
    throw profitResult.reason;
  }
  const data = profitResult.value;

  let partnerSettlement = EMPTY_PARTNER_SETTLEMENT;
  if (settlementResult.status === "fulfilled") {
    partnerSettlement = settlementResult.value;
  } else {
    console.error(
      "[admin/profit] partner settlement failed (run npm run db:push if partner_payments is missing):",
      settlementResult.reason,
    );
  }

  const owedByMonth: Record<string, number> = {};
  if (defaultMonthResult.status === "fulfilled") {
    for (const row of defaultMonthResult.value.rows) {
      owedByMonth[row.periodMonth] = row.owed;
    }
  }
  for (const row of partnerSettlement.rows) {
    owedByMonth[row.periodMonth] = row.owed;
  }

  const total = data.rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PROFIT_TABLE_PAGE_SIZE));
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page =
    Number.isFinite(requestedPage) && requestedPage >= 1
      ? Math.min(requestedPage, totalPages)
      : 1;
  const start = (page - 1) * PROFIT_TABLE_PAGE_SIZE;
  const pageRows = data.rows.slice(start, start + PROFIT_TABLE_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Finance"
        title="Profit calculation"
        description="Platform profit split into admin (80%) and partner (20%) shares for the selected period."
      />

      <Suspense fallback={<div className="h-28 animate-pulse rounded-[18px] bg-muted" />}>
        <AdminProfitFilters
          period={range.period}
          fromStr={range.fromStr}
          toStr={range.toStr}
          groupBy={range.groupBy}
        />
      </Suspense>

      <AdminProfitSummaryCards summary={data.summary} />

      <AdminPartnerSettlementSummary summary={partnerSettlement.summary} />

      <AdminPartnerPaymentForm
        defaultPeriodMonth={defaultPeriodMonth}
        owedByMonth={owedByMonth}
      />

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
