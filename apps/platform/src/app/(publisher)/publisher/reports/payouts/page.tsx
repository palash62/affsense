export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Banknote, CalendarCheck, CheckCircle, Clock, ListChecks } from "lucide-react";
import { getSession } from "@/lib/session";
import { isPublisherPortalRole } from "@/lib/publisher-page-title";
import { formatUserDateTime } from "@/lib/user-timezone";
import { getPublisherPayoutReport } from "@/services/payout.service";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { formatCurrency } from "@/components/admin/admin-ui";
import { AdvertiserLeadsTableFooter } from "@/components/advertiser/advertiser-leads-table-footer";
import { PublisherPayoutReportFilters } from "@/components/publisher/reports/publisher-payout-report-filters";
import { PublisherPayoutReportChart } from "@/components/publisher/reports/publisher-payout-report-chart";
import { PublisherPayoutReportTable } from "@/components/publisher/reports/publisher-payout-report-table";

const PER_PAGE = 10;

interface PageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    status?: string;
    method?: string;
    page?: string;
    sortBy?: string;
    sortDir?: string;
  }>;
}

export default async function PublisherPayoutReportPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!isPublisherPortalRole(session.user.role)) notFound();
  const tz = session.user.timezone;

  const params = await searchParams;
  const report = await getPublisherPayoutReport(session.user.id, {
    from: params.from ? new Date(`${params.from}T00:00:00`) : undefined,
    to: params.to ? new Date(`${params.to}T23:59:59`) : undefined,
    status: params.status,
    method: params.method,
    page: Math.max(1, parseInt(params.page ?? "1", 10) || 1),
    limit: PER_PAGE,
    sortBy: params.sortBy,
    sortDir: params.sortDir === "asc" ? "asc" : params.sortDir === "desc" ? "desc" : undefined,
  });
  const { kpis } = report;

  return (
    <div className="flex flex-col gap-5">
      <PageHero
        eyebrow="Reports"
        title="Payout Reports"
        description="Every invoice and payout paid to you, with status and method."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GradientStatCard
          label="Total Paid"
          value={formatCurrency(kpis.totalPaid)}
          icon={CheckCircle}
          variant="revenue"
        />
        <NeutralStatCard label="Pending" value={formatCurrency(kpis.pending)} icon={Clock} accent="orange" />
        <NeutralStatCard
          label="Last Payout"
          value={
            kpis.lastPayout
              ? `${formatCurrency(kpis.lastPayout.amount)} · ${formatUserDateTime(kpis.lastPayout.date, tz, "MMM d, yyyy")}`
              : "—"
          }
          icon={CalendarCheck}
          accent="green"
        />
        <NeutralStatCard label="Payments" value={kpis.count.toLocaleString("en-US")} icon={ListChecks} accent="purple" />
      </div>

      <PublisherPayoutReportChart monthly={report.monthly} />

      <PageSection
        title="Payout history"
        description={`${report.total.toLocaleString("en-US")} record${report.total === 1 ? "" : "s"}`}
        icon={Banknote}
        contentClassName="p-0"
      >
        <Suspense>
          <PublisherPayoutReportFilters methods={report.methods} />
        </Suspense>
        <Suspense>
          <PublisherPayoutReportTable rows={report.items} timezone={tz} />
        </Suspense>
        {report.total > 0 ? (
          <Suspense>
            <AdvertiserLeadsTableFooter
              page={report.page}
              totalPages={report.totalPages}
              total={report.total}
              perPage={PER_PAGE}
            />
          </Suspense>
        ) : null}
      </PageSection>
    </div>
  );
}
