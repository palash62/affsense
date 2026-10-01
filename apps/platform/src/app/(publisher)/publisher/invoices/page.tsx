import { Suspense } from "react";
import { Clock, FileText, Receipt } from "lucide-react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  getUninvoicedTotalForPublisher,
  listAffiliateInvoicesForPublisher,
} from "@/services/affiliate-invoice.service";
import { loadAffiliateInvoicingConfig } from "@/services/affiliate-invoicing-settings.service";
import { getPlatformSettings } from "@/services/wallet.service";
import { prisma } from "@/lib/prisma";
import { PublisherRequestInvoiceButton } from "@/components/publisher/publisher-request-invoice-button";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { formatCurrency } from "@/components/admin/admin-ui";
import { PageSection } from "@/components/admin/page-section";
import { PageHeader } from "@/components/layout/page-header";
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

  const [invoices, pending, config, platformSettings, unpaidInvoice] = await Promise.all([
    listAffiliateInvoicesForPublisher(session.user.id, { page, limit: 20 }),
    getUninvoicedTotalForPublisher(session.user.id),
    loadAffiliateInvoicingConfig(),
    getPlatformSettings(),
    prisma.affiliateInvoice.findFirst({
      where: { publisherId: session.user.id, status: "UNPAID" },
      select: { number: true },
    }),
  ]);

  const weekly = config.enabled;
  const minimumAmount = platformSettings.minPayoutAmount;

  const unpaidTotal = invoices.invoices
    .filter((invoice) => invoice.status === "UNPAID")
    .reduce((sum, invoice) => sum + invoice.total, 0);

  const requestDisabledReason = unpaidInvoice
    ? `Invoice ${unpaidInvoice.number} is awaiting payment. You can request a new one once it is paid.`
    : pending < minimumAmount
      ? `You need at least ${formatCurrency(minimumAmount)} in uninvoiced earnings to request an invoice.`
      : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        description={
          weekly
            ? `Earnings run Monday to Sunday. Each Monday your uninvoiced earnings are invoiced once they reach ${formatCurrency(minimumAmount)}, payable within ${config.netTermDays} days.`
            : `Request an invoice for your uninvoiced earnings once they reach ${formatCurrency(minimumAmount)}, payable within ${config.netTermDays} days.`
        }
        breadcrumbs={[
          { label: "Publisher", href: "/publisher" },
          { label: "Invoices" },
        ]}
      >
        {weekly ? null : <PublisherRequestInvoiceButton disabledReason={requestDisabledReason} />}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <GradientStatCard
          variant="revenue"
          label="Awaiting payment"
          value={formatCurrency(unpaidTotal)}
          icon={FileText}
        />
        <NeutralStatCard
          label={weekly ? "Accruing this period" : "Ready to invoice"}
          value={formatCurrency(pending)}
          icon={Clock}
          accent="orange"
        />
        <NeutralStatCard
          label="Minimum to invoice"
          value={formatCurrency(minimumAmount)}
          icon={Receipt}
          accent="purple"
        />
      </div>

      <PageSection
        title="Invoice history"
        description={
          weekly
            ? "Anything below the minimum rolls into the next week."
            : "Invoices you have requested, newest first."
        }
        icon={Receipt}
        gradient="revenue"
      >
        <PublisherInvoicesList
          invoices={invoices.invoices}
          timezone={tz ?? undefined}
          periodTimezone={config.timezone}
          weekly={weekly}
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
