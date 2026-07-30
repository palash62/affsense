export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { formatUserDateTime } from "@/lib/user-timezone";
import { FileText, Info } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import { listPublisherSubIdLeadReport } from "@/services/lead.service";
import { PageSection } from "@/components/admin/page-section";
import { RoleHero } from "@/components/layout/role-hero";
import { PublisherLeadReportFilters } from "@/components/publisher/publisher-lead-report-filters";
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
    subId?: string;
    from?: string;
    to?: string;
  }>;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

export default async function PublisherLeadReportPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const tz = session.user.timezone;

  const params = await searchParams;
  const dateFrom = params.from ?? defaultCampaignDateFrom();
  const dateTo = params.to ?? defaultCampaignDateTo();

  const subIdReport = await listPublisherSubIdLeadReport({
    publisherId: session.user.id,
    subIdSearch: params.subId,
    campaignSearch: params.campaign,
    dateFrom: new Date(dateFrom),
    dateTo: new Date(dateTo),
  });

  return (
    <div className="space-y-6">
      <RoleHero
        eyebrow="Publisher Portal"
        title="Lead Report"
        description="Review lead performance by sub ID to see which traffic sources earn the most."
      />

      <div
        className="flex gap-3 rounded-xl border px-4 py-3 text-sm text-slate-700"
        style={{
          borderColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)",
          background: "var(--theme-primary-soft)",
        }}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]" />
        <p>
          Use <code className="rounded bg-white/80 px-1">?sub_id=</code> on your Smart Link to tag
          traffic sources. Earnings include approved and paid leads in the selected date range. For
          individual lead records, see{" "}
          <Link
            href="/publisher/leads"
            className="font-medium text-[var(--theme-primary)] hover:underline"
          >
            Leads
          </Link>
          .
        </p>
      </div>

      <PageSection
        title="Sub ID Lead Report"
        description="Aggregated lead counts and earnings by sub ID"
        icon={FileText}
        gradient="leads"
      >
        <Suspense fallback={<div className="px-6 py-4 text-sm text-slate-500">Loading filters...</div>}>
          <PublisherLeadReportFilters />
        </Suspense>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow
                className="border-none hover:bg-transparent"
                style={{ background: "var(--theme-primary-soft)" }}
              >
                <TableHead className="h-11 px-6 text-slate-600">Sub ID</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Total</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Approved</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Pending</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Rejected</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Paid</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Earnings</TableHead>
                <TableHead className="h-11 px-6 text-slate-600">Last Lead</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subIdReport.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="h-48 px-6 py-16 text-center">
                    <p className="text-base font-medium text-slate-500">No Data Found</p>
                  </TableCell>
                </TableRow>
              ) : (
                subIdReport.map((row) => (
                  <TableRow
                    key={row.subId}
                    className="border-slate-100 transition-colors hover:bg-blue-50/40"
                  >
                    <TableCell className="px-6 py-4 font-mono text-sm font-medium text-slate-800">
                      {row.subId}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm text-slate-700">
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
                    <TableCell className="px-4 py-4 text-right text-sm text-slate-700">
                      {row.paidLeads}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm font-medium text-emerald-700">
                      {formatCurrency(row.earnings)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {row.lastLeadAt
                        ? formatUserDateTime(row.lastLeadAt, tz, "MMM d, yyyy HH:mm")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </PageSection>
    </div>
  );
}
