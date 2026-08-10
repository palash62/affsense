export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { formatUserDateTime } from "@/lib/user-timezone";
import { CheckCircle, FileText, ShieldAlert, XCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import {
  formatAdvertiserLeadCpl,
  formatLeadDataSummary,
} from "@/lib/advertiser-lead-details";
import { getLeadCpl } from "@/lib/lead-cpl";
import {
  extractLeadCountry,
  formatLeadIp,
  formatLeadRejectReason,
  parseUserAgent,
  shortLeadId,
} from "@/lib/publisher-leads";
import { listLeads, type AdvertiserLeadSort } from "@/services/lead.service";
import { formatLeadRevenue, formatLeadSaleLabel } from "@/lib/cpa-lead-metrics";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { AdminLeadDetailsFilters } from "@/components/admin/admin-lead-details-filters";
import {
  AdminLeadsBulkTable,
  type AdminLeadTableRow,
} from "@/components/admin/admin-leads-bulk-table";
import { AdvertiserLeadsTableFooter } from "@/components/advertiser/advertiser-leads-table-footer";
import type { LeadStatus } from "@prisma/client";

interface PageProps {
  searchParams: Promise<{
    advertiserId?: string;
    campaignId?: string;
    publisherId?: string;
    status?: string;
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

export default async function AdminLeadsPage({ searchParams }: PageProps) {
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

  const [
    total,
    approved,
    rejected,
    highRisk,
    campaigns,
    advertisers,
    publishers,
    { data: leads, meta },
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: { in: ["APPROVED", "PAID"] } } }),
    prisma.lead.count({ where: { status: "REJECTED" } }),
    prisma.lead.count({ where: { riskScore: { gt: 50 } } }),
    prisma.campaign.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "ADVERTISER" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "PUBLISHER" },
      select: {
        id: true,
        name: true,
        email: true,
        publisherProfile: { select: { website: true } },
      },
      orderBy: { name: "asc" },
    }),
    listLeads({
      advertiserId: params.advertiserId,
      campaignId: params.campaignId,
      publisherId: params.publisherId,
      status,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      sort: parseSort(params.sort),
      page,
      limit,
    }),
  ]);

  const rows: AdminLeadTableRow[] = leads.map((lead) => {
    const { device, os } = parseUserAgent(lead.userAgent);
    const country = extractLeadCountry(
      lead.data,
      lead.country,
      lead.geoCountry,
      lead.submissionMeta,
    );
    const cpl = formatAdvertiserLeadCpl(lead.status, getLeadCpl(lead));
    const notes = formatLeadRejectReason(lead);
    const leadData = formatLeadDataSummary(lead.data);
    const failedFlags = lead.validationResults.filter((r) => !r.passed);

    return {
      id: lead.id,
      status: lead.status,
      createdAtLabel: formatUserDateTime(lead.createdAt, tz, "MMM d, yyyy HH:mm:ss"),
      shortId: shortLeadId(lead.id),
      advertiserName: lead.campaign.advertiser?.name ?? "—",
      campaignName: lead.campaign.name,
      publisherName: lead.publisher.name,
      leadData,
      country,
      ip: formatLeadIp(lead.ip),
      source: lead.source ?? "—",
      subId: lead.subId ?? "—",
      device,
      os,
      cpl,
      sales: formatLeadSaleLabel(lead.salesCount),
      revenue: formatLeadRevenue(lead.revenue),
      ctaClicked: Boolean(lead.ctaClicked),
      riskScore: lead.riskScore,
      flags: failedFlags.map((r) => r.rule),
      notes,
    };
  });

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow="Lead Management"
        title="All Leads"
        description="Review lead submissions with full data across all campaigns and advertisers"
        badge={`${meta.total} lead${meta.total === 1 ? "" : "s"} in range`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GradientStatCard variant="leads" label="Total Leads" value={total} icon={FileText} />
        <NeutralStatCard label="Approved" value={approved} icon={CheckCircle} accent="green" />
        <NeutralStatCard label="Rejected" value={rejected} icon={XCircle} accent="red" />
        <NeutralStatCard label="High Risk" value={highRisk} icon={ShieldAlert} accent="red" />
      </div>

      <PageSection
        title="Lead Details"
        description={`${meta.total} lead${meta.total === 1 ? "" : "s"} matching filters`}
        icon={FileText}
        gradient="leads"
      >
        <Suspense fallback={<div className="px-6 py-4 text-sm text-muted-foreground">Loading filters...</div>}>
          <AdminLeadDetailsFilters
            campaigns={campaigns}
            advertisers={advertisers}
            publishers={publishers}
          />
        </Suspense>

        <AdminLeadsBulkTable rows={rows} />

        <Suspense>
          <AdvertiserLeadsTableFooter
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            perPage={limit}
          />
        </Suspense>

        <div className="border-t border-border px-6 py-4">
          <Link href="/admin/fraud" className="text-sm font-medium text-[var(--theme-primary)] hover:underline">
            Open Fraud Center for high-risk review →
          </Link>
        </div>
      </PageSection>
    </div>
  );
}
