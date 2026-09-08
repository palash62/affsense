import { Suspense } from "react";
import { Clock, FileText, Receipt } from "lucide-react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  getUninvoicedTotalForPublisher,
  listAffiliateInvoicesForPublisher,
} from "@/services/affiliate-invoice.service";
import { loadAffiliateInvoicingConfig } from "@/services/affiliate-invoicing-settings.service";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { formatCurrency } from "@/components/admin/admin-ui";
import { PageSection } from "@/components/admin/page-section";
import { PublisherInvoicesList } from "@/components/publisher/publisher-invoices-list";
import { UsersTablePagination } from "@/components/admin/users-table-pagination";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function PublisherInvoicesPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const tz = session.user.timezone;
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const [invoices, pending, config] = await Promise.all([
    listAffiliateInvoicesForPublisher(session.user.id, { page, limit: 20 }),
    getUninvoicedTotalForPublisher(session.user.id),
    loadAffiliateInvoicingConfig(),
  ]);

  const unpaidTotal = invoices.invoices
    .filter((invoice) => invoice.status === "UNPAID")
    .reduce((sum, invoice) => sum + invoice.total, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <GradientStatCard
          variant="revenue"
          label="Awaiting payment"
          value={formatCurrency(unpaidTotal)}
          icon={FileText}
        />
        <NeutralStatCard
          label="Accruing this period"
          value={formatCurrency(pending)}
          icon={Clock}
          accent="orange"
        />
        <NeutralStatCard
          label="Minimum to invoice"
          value={formatCurrency(config.minimumAmount)}
          icon={Receipt}
          accent="purple"
        />
      </div>

      <PageSection
        title="Invoices"
        description={`Earnings run Monday to Sunday. Each Monday your uninvoiced earnings are invoiced once they reach ${formatCurrency(config.minimumAmount)}, payable within ${config.netTermDays} days. Anything below the minimum rolls into the next week.`}
        icon={Receipt}
        gradient="revenue"
      >
        <PublisherInvoicesList
          invoices={invoices.invoices}
          timezone={tz ?? undefined}
          periodTimezone={config.timezone}
        />
        {invoices.totalPages > 1 ? (
          <Suspense fallback={null}>
            <UsersTablePagination
              page={invoices.page}
              totalPages={invoices.totalPages}
              total={invoices.total}
            />
          </Suspense>
        ) : null}
      </PageSection>
    </div>
  );
}
