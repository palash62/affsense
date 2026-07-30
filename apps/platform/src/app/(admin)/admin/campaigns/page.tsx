import { Suspense } from "react";
import { formatUserDateTime } from "@/lib/user-timezone";
import { getSession } from "@/lib/session";
import { Building2, DollarSign, FileText, Megaphone, Users } from "lucide-react";
import type { CampaignStatus } from "@prisma/client";
import { listCampaigns, type CampaignSort } from "@/services/admin.service";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { CampaignStatusBadge, formatCurrency } from "@/components/admin/admin-ui";
import { CampaignsTableFilters } from "@/components/admin/campaigns-table-filters";
import { AdminCampaignActions } from "@/components/admin/admin-campaign-actions";
import { ButtonLink } from "@/components/ui/button-link";
import { Eye } from "lucide-react";
import { UsersTablePagination } from "@/components/admin/users-table-pagination";
import { parseCampaignTargeting } from "@/lib/campaign-targeting";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    sort?: string;
    cplMin?: string;
    cplMax?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

function parseCampaignStatus(status?: string): CampaignStatus | "STOP" | undefined {
  if (!status || status === "all") return undefined;
  if (status === "STOP") return "STOP";
  const valid: CampaignStatus[] = ["DRAFT", "PENDING", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];
  return valid.includes(status as CampaignStatus) ? (status as CampaignStatus) : undefined;
}

function parseSort(sort?: string): CampaignSort {
  if (sort === "cpl_asc" || sort === "cpl_desc") return sort;
  return "created_desc";
}

export default async function AdminCampaignsPage({ searchParams }: PageProps) {
  const session = await getSession();
  const tz = session?.user?.timezone;
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const cplMin = params.cplMin ? parseFloat(params.cplMin) : undefined;
  const cplMax = params.cplMax ? parseFloat(params.cplMax) : undefined;

  const [{ data: campaigns, meta }, { data: allCampaigns }] = await Promise.all([
    listCampaigns({
      search: params.q,
      status: parseCampaignStatus(params.status),
      cplMin: cplMin !== undefined && !Number.isNaN(cplMin) ? cplMin : undefined,
      cplMax: cplMax !== undefined && !Number.isNaN(cplMax) ? cplMax : undefined,
      dateFrom: params.from ? new Date(params.from) : undefined,
      dateTo: params.to ? new Date(params.to) : undefined,
      sort: parseSort(params.sort),
      page,
      limit: 20,
    }),
    listCampaigns({ limit: 500 }),
  ]);

  const activeCount = allCampaigns.filter((c) => c.status === "ACTIVE").length;
  const totalLeads = allCampaigns.reduce((sum, c) => sum + c._count.leads, 0);
  const totalSpent = allCampaigns.reduce((sum, c) => sum + Number(c.spent), 0);
  const avgCpl = allCampaigns.length
    ? allCampaigns.reduce((sum, c) => sum + Number(c.cpl), 0) / allCampaigns.length
    : 0;

  const hasFilters = !!(
    params.q ||
    params.status ||
    params.sort ||
    params.cplMin ||
    params.cplMax ||
    params.from ||
    params.to
  );

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow="Campaign Management"
        title="All Campaigns"
        description="Manage campaigns across all advertisers"
        badge={`${meta.total} campaign${meta.total === 1 ? "" : "s"}`}
      />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <ButtonLink
          href="/admin/campaigns/new"
          className="h-10 gap-2 rounded-xl bg-[var(--theme-primary)] px-4 hover:opacity-90"
        >
          <Megaphone className="h-4 w-4" />
          Add Campaign
        </ButtonLink>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GradientStatCard variant="revenue" label="Total Spent" value={formatCurrency(totalSpent)} icon={DollarSign} />
        <NeutralStatCard label="Active Campaigns" value={activeCount} icon={Megaphone} accent="green" />
        <NeutralStatCard label="Total Leads" value={totalLeads} icon={FileText} accent="purple" />
        <NeutralStatCard label="Avg CPL" value={formatCurrency(avgCpl)} icon={Users} accent="orange" />
      </div>

      <PageSection
        title="Campaign List"
        description={
          hasFilters
            ? `Showing ${campaigns.length} filtered result${campaigns.length === 1 ? "" : "s"}`
            : "All campaigns running on the platform"
        }
        icon={Megaphone}
        gradient="approved"
      >
        <Suspense fallback={<div className="px-6 py-4 text-sm text-slate-500">Loading filters...</div>}>
          <CampaignsTableFilters />
        </Suspense>

        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--theme-primary-soft)" }}>
              <Megaphone className="h-7 w-7 text-[var(--theme-primary)]" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              {hasFilters ? "No matching campaigns" : "No campaigns yet"}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {hasFilters
                ? "Try adjusting your search or filter criteria."
                : "Campaigns will appear here once advertisers create them."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-none hover:bg-transparent" style={{ background: "var(--theme-primary-soft)" }}>
                  <TableHead className="h-11 px-6 text-slate-600">Campaign</TableHead>
                  <TableHead className="h-11 px-4 text-slate-600">Advertiser</TableHead>
                  <TableHead className="h-11 px-4 text-right text-slate-600">CPL</TableHead>
                  <TableHead className="h-11 px-4 text-center text-slate-600">Leads</TableHead>
                  <TableHead className="h-11 px-4 text-right text-slate-600">Spent</TableHead>
                  <TableHead className="h-11 px-4 text-slate-600">Status</TableHead>
                  <TableHead className="h-11 px-4 text-slate-600">Created</TableHead>
                  <TableHead className="h-11 px-6 text-right text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id} className="border-slate-100 transition-colors hover:bg-blue-50/40">
                    <TableCell className="px-6 py-4">
                      <p className="font-medium text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.category}</p>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                        <span className="text-sm text-slate-700">{c.advertiser.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right">
                      <span className="font-semibold text-[var(--theme-primary)]">
                        {formatCurrency(Number(c.cpl))}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-center">
                      <span className="inline-flex min-w-8 items-center justify-center rounded-md bg-indigo-50 px-2.5 py-1 text-sm font-semibold text-indigo-700">
                        {c._count.leads}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm font-medium text-slate-700">
                      {formatCurrency(Number(c.spent))}
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <CampaignStatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-slate-500">
                      {formatUserDateTime(c.createdAt, tz, "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <ButtonLink
                          href={`/admin/campaigns/${c.id}`}
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </ButtonLink>
                        <AdminCampaignActions
                          campaign={{
                            id: c.id,
                            name: c.name,
                            status: c.status,
                            leadCount: c._count.leads,
                            funnelSlug:
                              c.optinPages[0]?.slug ??
                              parseCampaignTargeting(c.targeting).optinSlug,
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            <Suspense>
              <UsersTablePagination page={meta.page} totalPages={meta.totalPages} total={meta.total} />
            </Suspense>
          </>
        )}
      </PageSection>
    </div>
  );
}
