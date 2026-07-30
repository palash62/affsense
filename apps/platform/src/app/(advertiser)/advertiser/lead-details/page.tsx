export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { formatUserDateTime } from "@/lib/user-timezone";
import { FileText, Info } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { shortPublisherId } from "@/lib/advertiser-leads";
import {
  formatAdvertiserLeadCpl,
  formatLeadDataSummary,
} from "@/lib/advertiser-lead-details";
import { getLeadCpl } from "@/lib/lead-cpl";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import {
  extractLeadCountry,
  formatLeadIp,
  formatLeadRejectReason,
  parseUserAgent,
  shortLeadId,
} from "@/lib/publisher-leads";
import { listLeads, type AdvertiserLeadSort } from "@/services/lead.service";
import { formatLeadRevenue, formatLeadSaleLabel } from "@/lib/cpa-lead-metrics";
import { PageSection } from "@/components/admin/page-section";
import { LeadStatusBadge } from "@/components/admin/admin-ui";
import { RoleHero } from "@/components/layout/role-hero";
import { AdvertiserLeadDetailsFilters } from "@/components/advertiser/advertiser-lead-details-filters";
import { AdvertiserLeadsSortHeader } from "@/components/advertiser/advertiser-leads-sort-header";
import { AdvertiserLeadsTableFooter } from "@/components/advertiser/advertiser-leads-table-footer";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LeadStatus } from "@prisma/client";

interface PageProps {
  searchParams: Promise<{
    campaignId?: string;
    status?: string;
    email?: string;
    from?: string;
    to?: string;
    sort?: string;
    page?: string;
  }>;
}

function parseSort(sort?: string): AdvertiserLeadSort {
  const valid: AdvertiserLeadSort[] = [
    "created_desc",
    "created_asc",
    "campaign_asc",
    "campaign_desc",
    "status_asc",
    "status_desc",
  ];
  return valid.includes(sort as AdvertiserLeadSort)
    ? (sort as AdvertiserLeadSort)
    : "created_desc";
}

function riskBadge(score: number | null) {
  if (score === null) return <span className="text-slate-400">—</span>;
  const cls =
    score > 50
      ? "bg-red-100 text-red-700"
      : score > 20
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-700";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", cls)}>
      {score}
    </span>
  );
}

export default async function AdvertiserLeadDetailsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  const tz = session.user.timezone;

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 15;
  const dateFrom = params.from ?? defaultCampaignDateFrom();
  const dateTo = params.to ?? defaultCampaignDateTo();

  const status =
    params.status &&
    ["CAPTURED", "VALIDATING", "PENDING", "APPROVED", "REJECTED", "PAID"].includes(params.status)
      ? (params.status as LeadStatus)
      : undefined;

  const [campaigns, { data: leads, meta }] = await Promise.all([
    prisma.campaign.findMany({
      where: { advertiserId: session.user.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    listLeads({
      advertiserId: session.user.id,
      campaignId: params.campaignId,
      status,
      email: params.email,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      sort: parseSort(params.sort),
      page,
      limit,
    }),
  ]);

  return (
    <div className="space-y-6">
      <RoleHero
        eyebrow="Advertiser Portal"
        title="Lead Details"
        description="Browse every lead on your campaigns with full submission data and status history."
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
          Filter by campaign to focus on a single offer. Publisher IDs are masked for privacy. For
          publisher-level aggregates, see{" "}
          <Link
            href="/advertiser/lead-report"
            className="font-medium text-[var(--theme-primary)] hover:underline"
          >
            Lead Report
          </Link>
          .
        </p>
      </div>

      <PageSection
        title="All Leads"
        description={`${meta.total} lead${meta.total === 1 ? "" : "s"} in selected range`}
        icon={FileText}
        gradient="leads"
      >
        <Suspense fallback={<div className="px-6 py-4 text-sm text-slate-500">Loading filters...</div>}>
          <AdvertiserLeadDetailsFilters campaigns={campaigns} />
        </Suspense>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow
                className="border-none hover:bg-transparent"
                style={{ background: "var(--theme-primary-soft)" }}
              >
                <TableHead className="h-11 whitespace-nowrap px-4 text-slate-600">
                  <Suspense fallback={<span>Date / Time</span>}>
                    <AdvertiserLeadsSortHeader field="at" label="Date / Time" />
                  </Suspense>
                </TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-slate-600">Lead ID</TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-slate-600">
                  <Suspense fallback={<span>Campaign</span>}>
                    <AdvertiserLeadsSortHeader field="campaign" label="Campaign" />
                  </Suspense>
                </TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-slate-600">Publisher ID</TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-slate-600">Lead Data</TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-slate-600">Country</TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-slate-600">IP</TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-slate-600">Device</TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-slate-600">OS</TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-right text-slate-600">CPL</TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-right text-slate-600">Sales</TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-right text-slate-600">Revenue</TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-slate-600">CTA</TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-slate-600">Risk</TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-slate-600">
                  <Suspense fallback={<span>Status</span>}>
                    <AdvertiserLeadsSortHeader field="status" label="Status" />
                  </Suspense>
                </TableHead>
                <TableHead className="h-11 min-w-[160px] whitespace-nowrap px-4 text-slate-600">
                  Notes
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={16} className="h-48 px-6 py-16 text-center">
                    <p className="text-base font-medium text-slate-500">No leads found</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Try adjusting the campaign filter or date range.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => {
                  const { device, os } = parseUserAgent(lead.userAgent);
                  const country = extractLeadCountry(
                    lead.data,
                    lead.country,
                    lead.geoCountry,
                    lead.submissionMeta,
                  );
                  const cpl = formatAdvertiserLeadCpl(
                    lead.status,
                    getLeadCpl(lead),
                    lead.isTest,
                  );
                  const notes = formatLeadRejectReason(lead);
                  const leadData = formatLeadDataSummary(lead.data);

                  return (
                    <TableRow
                      key={lead.id}
                      className="border-slate-100 transition-colors hover:bg-blue-50/40"
                    >
                      <TableCell className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                        {formatUserDateTime(lead.createdAt, tz, "MMM d, yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4 font-mono text-xs text-slate-500">
                        <span className="inline-flex items-center gap-2">
                          {shortLeadId(lead.id)}
                          {lead.isTest ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 ring-1 ring-red-200">
                              Test
                            </span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[140px] px-4 py-4 text-sm font-medium text-slate-800">
                        <span className="line-clamp-2" title={lead.campaign.name}>
                          {lead.campaign.name}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4 font-mono text-xs text-slate-600">
                        {shortPublisherId(lead.publisherId)}
                      </TableCell>
                      <TableCell className="max-w-[220px] px-4 py-4 text-sm text-slate-700">
                        <span className="line-clamp-2" title={leadData}>
                          {leadData}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                        {country}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4 font-mono text-xs text-slate-600">
                        {formatLeadIp(lead.ip)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                        {device}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                        {os}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4 text-right text-sm text-slate-700">
                        {cpl}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4 text-right text-sm text-slate-700">
                        {formatLeadSaleLabel(lead.salesCount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4 text-right text-sm text-slate-700">
                        {formatLeadRevenue(lead.revenue)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4">
                        {lead.ctaClicked ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            Yes
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                            No
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-4">{riskBadge(lead.riskScore)}</TableCell>
                      <TableCell className="px-4 py-4">
                        <LeadStatusBadge status={lead.status} />
                      </TableCell>
                      <TableCell className="max-w-[180px] px-4 py-4 text-sm text-slate-600">
                        <span className="line-clamp-2" title={notes}>
                          {notes}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <Suspense>
          <AdvertiserLeadsTableFooter
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            perPage={limit}
          />
        </Suspense>
      </PageSection>
    </div>
  );
}
