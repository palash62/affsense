export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { formatUserDateTime } from "@/lib/user-timezone";
import { Ban, FileText, Info } from "lucide-react";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { shortPublisherId } from "@/lib/advertiser-leads";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import { listAdvertiserPublisherLeadReport } from "@/services/lead.service";
import { listBlockedPublishers } from "@/services/smart-link.service";
import { PageSection } from "@/components/admin/page-section";
import { RoleHero } from "@/components/layout/role-hero";
import { AdvertiserBlockPublisherButton } from "@/components/advertiser/advertiser-block-publisher-button";
import { AdvertiserBlockedPublishersTable } from "@/components/advertiser/advertiser-blocked-publishers-table";
import { AdvertiserLeadsFilters } from "@/components/advertiser/advertiser-leads-filters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PageProps {
  searchParams: Promise<{
    campaign?: string;
    publisher?: string;
    payoutMin?: string;
    payoutMax?: string;
    from?: string;
    to?: string;
  }>;
}

function formatPayoutRange(min: number | null, max: number | null) {
  if (min === null || max === null) return "—";
  if (min === max) return formatCurrency(min);
  return `${formatCurrency(min)} – ${formatCurrency(max)}`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

export default async function AdvertiserLeadReportPage({ searchParams }: PageProps) {
  const session = await getSession();
  const tz = session!.user.timezone;
  const params = await searchParams;
  const dateFrom = params.from ?? defaultCampaignDateFrom();
  const dateTo = params.to ?? defaultCampaignDateTo();
  const payoutMin = params.payoutMin ? parseFloat(params.payoutMin) : undefined;
  const payoutMax = params.payoutMax ? parseFloat(params.payoutMax) : undefined;

  const [publisherReport, blockedPublishers] = await Promise.all([
    listAdvertiserPublisherLeadReport({
      advertiserId: session!.user.id,
      publisherSearch: params.publisher,
      campaignSearch: params.campaign,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      payoutMin: payoutMin !== undefined && !Number.isNaN(payoutMin) ? payoutMin : undefined,
      payoutMax: payoutMax !== undefined && !Number.isNaN(payoutMax) ? payoutMax : undefined,
    }),
    listBlockedPublishers(session!.user.id),
  ]);

  const blockedIds = new Set(blockedPublishers.map((b) => b.publisherId));

  return (
    <div className="space-y-6">
      <RoleHero
        eyebrow="Advertiser Portal"
        title="Lead Report"
        description="Review lead performance by publisher, block low-quality traffic, and manage your block list."
      />

      <div
        className="flex gap-3 rounded-xl border px-4 py-3 text-sm text-foreground"
        style={{
          borderColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)",
          background: "var(--theme-primary-soft)",
        }}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]" />
        <p>
          Publisher names are hidden for privacy. Use the publisher ID to identify traffic sources.
          Blocked publishers are excluded from Smart Link rotation for your campaigns. For individual
          lead records, see{" "}
          <Link
            href="/advertiser/lead-details"
            className="font-medium text-[var(--theme-primary)] hover:underline"
          >
            Lead Details
          </Link>
          . For campaign-level stats, see the{" "}
          <Link
            href="/advertiser/reports"
            className="font-medium text-[var(--theme-primary)] hover:underline"
          >
            campaign statistics report
          </Link>
          .
        </p>
      </div>

      <PageSection
        title="Publisher Lead Report"
        description="Aggregated lead counts and spend by publisher"
        icon={FileText}
        gradient="leads"
      >
        <Suspense fallback={<div className="px-6 py-4 text-sm text-muted-foreground">Loading filters...</div>}>
          <AdvertiserLeadsFilters />
        </Suspense>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow
                className="border-none hover:bg-transparent"
                style={{ background: "var(--theme-primary-soft)" }}
              >
                <TableHead className="h-11 px-6 text-muted-foreground">Publisher ID</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Total</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Approved</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Pending</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Rejected</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Paid</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Sales</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Revenue</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Payout Range</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Est. Spend</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Last Lead</TableHead>
                <TableHead className="h-11 px-6 text-right text-muted-foreground">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {publisherReport.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={12} className="h-48 px-6 py-16 text-center">
                    <p className="text-base font-medium text-muted-foreground">No Data Found</p>
                  </TableCell>
                </TableRow>
              ) : (
                publisherReport.map((row) => (
                  <TableRow
                    key={row.publisherId}
                    className="border-border transition-colors hover:bg-blue-50/40"
                  >
                    <TableCell className="px-6 py-4 font-mono text-sm font-medium text-foreground">
                      {shortPublisherId(row.publisherId)}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm text-foreground">
                      {row.totalLeads}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm text-emerald-700">
                      {row.approvedLeads}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm text-amber-700">
                      {row.pendingLeads}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm text-red-700">
                      {row.rejectedLeads}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm text-foreground">
                      {row.paidLeads}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm text-foreground">
                      {row.salesCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm font-medium text-foreground">
                      {formatCurrency(row.revenue)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-4 text-right text-sm text-muted-foreground">
                      {formatPayoutRange(row.payoutMin, row.payoutMax)}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm font-medium text-foreground">
                      {formatCurrency(row.estimatedSpend)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
                      {row.lastLeadAt
                        ? formatUserDateTime(row.lastLeadAt, tz, "MMM d, yyyy HH:mm")
                        : "—"}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <AdvertiserBlockPublisherButton
                        publisherId={row.publisherId}
                        blocked={blockedIds.has(row.publisherId)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </PageSection>

      <PageSection
        title="Blocked Publishers"
        description={`${blockedPublishers.length} publisher${blockedPublishers.length === 1 ? "" : "s"} blocked from your campaigns`}
        icon={Ban}
        gradient="revenue"
      >
        <AdvertiserBlockedPublishersTable
          timezone={tz}
          blockedPublishers={blockedPublishers.map((b) => ({
            publisherId: b.publisherId,
            createdAt: b.createdAt,
          }))}
        />
      </PageSection>
    </div>
  );
}
