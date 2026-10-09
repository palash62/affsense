import { isAdminPortalRole } from "@/lib/admin-portal";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  PROFIT_TABLE_PAGE_SIZE,
  resolveProfitPageRange,
} from "@/services/admin-profit.service";
import {
  getInvoiceProfitPageData,
  listPartnerInvoices,
  summarizePartnerInvoices,
} from "@/services/partner-invoice.service";
import { PageHero } from "@/components/admin/page-hero";
import { AdminProfitFilters } from "@/components/admin/admin-profit-filters";
import {
  AdminPartnerInvoiceSummary,
  AdminPartnerInvoiceTable,
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
  if (!session?.user || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  const params = await searchParams;
  const range = resolveProfitPageRange(params);
  const [data, invoices] = await Promise.all([
    getInvoiceProfitPageData(range.from, range.to, range.groupBy),
    listPartnerInvoices(),
  ]);
  const canPayPartner = session.user.role === "ADMIN" && !session.impersonatorId;

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
        description="Platform profit = marketplace sales − refunds + Offer Wall network payout + Solo Ads click charges + paid CPA invoices − affiliate and referral commissions − Solo Ads provider cost. Each amount counts on the date it happened. Admin gets 80%, the partner 20%."
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

      <AdminPartnerInvoiceSummary summary={summarizePartnerInvoices(invoices)} />

      <AdminPartnerInvoiceTable invoices={invoices} canPay={canPayPartner} />

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
