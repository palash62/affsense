export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { formatUserDateTime } from "@/lib/user-timezone";
import { FileText } from "lucide-react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  extractLeadCountry,
  formatLeadRejectReason,
  formatPublisherLeadPayout,
  parseUserAgent,
  shortLeadId,
} from "@/lib/publisher-leads";
import { getPlatformSettingsConfig } from "@/lib/platform-settings-server";
import { listLeads, type AdvertiserLeadSort } from "@/services/lead.service";
import { PageSection } from "@/components/admin/page-section";
import { LeadStatusBadge } from "@/components/admin/admin-ui";
import { RoleHero } from "@/components/layout/role-hero";
import { AdvertiserLeadsTableFooter } from "@/components/advertiser/advertiser-leads-table-footer";
import { PublisherInfoBanner } from "@/components/publisher/publisher-info-banner";
import { PublisherLeadsFilters } from "@/components/publisher/publisher-leads-filters";
import { PublisherLeadsSortHeader } from "@/components/publisher/publisher-leads-sort-header";
import { cn } from "@/lib/utils";
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
    source?: string;
    sort?: string;
    page?: string;
  }>;
}

function parseSort(sort?: string): AdvertiserLeadSort {
  const valid: AdvertiserLeadSort[] = [
    "created_desc",
    "created_asc",
    "status_asc",
    "status_desc",
  ];
  return valid.includes(sort as AdvertiserLeadSort)
    ? (sort as AdvertiserLeadSort)
    : "created_desc";
}

export default async function PublisherLeadsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const tz = session.user.timezone;

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 10;
  const userId = session.user.id;

  const [settings, { data: leads, meta }] = await Promise.all([
    getPlatformSettingsConfig(),
    listLeads({
      publisherId: userId,
      source: params.source,
      sort: parseSort(params.sort),
      page,
      limit,
    }),
  ]);
  const leadIds = leads.map((lead) => lead.id);
  const creditedEntries =
    leadIds.length > 0
      ? await prisma.ledgerEntry.findMany({
          where: {
            type: "CREDIT",
            referenceType: "lead",
            referenceId: { in: leadIds },
            wallet: { userId },
          },
          select: { referenceId: true, amount: true },
        })
      : [];
  const creditedByLeadId = new Map(
    creditedEntries.map((entry) => [entry.referenceId, Number(entry.amount)]),
  );

  return (
    <div className="space-y-6">
      <RoleHero
        eyebrow="Publisher Portal"
        title="My Leads"
        description="Track leads you've generated through your Smart Link."
      />

      <PublisherInfoBanner>
        Review date, payout, country, device, and status for each lead. Rejected leads show the
        rejection reason so you can improve traffic quality.
      </PublisherInfoBanner>

      <PageSection
        title="Lead Submissions"
        description="Detailed lead activity from your Smart Link"
        icon={FileText}
        gradient="leads"
      >
        <Suspense fallback={<div className="px-6 py-4 text-sm text-muted-foreground">Loading filters...</div>}>
          <PublisherLeadsFilters />
        </Suspense>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow
                className="border-none hover:bg-transparent"
                style={{ background: "var(--theme-primary-soft)" }}
              >
                <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">
                  <Suspense fallback={<span>Date / Time</span>}>
                    <PublisherLeadsSortHeader field="at" label="Date / Time" />
                  </Suspense>
                </TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">Lead ID</TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-right text-muted-foreground">
                  Payout
                </TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">Country</TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">
                  <Suspense fallback={<span>Status</span>}>
                    <PublisherLeadsSortHeader field="status" label="Status" />
                  </Suspense>
                </TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">Device</TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">OS</TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">Source</TableHead>
                <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">CTA</TableHead>
                <TableHead className="h-11 min-w-[180px] whitespace-nowrap px-4 text-muted-foreground">
                  Reject Reason
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={10} className="h-48 px-6 py-16 text-center">
                    <p className="text-base font-medium text-muted-foreground">No leads found</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Share your Smart Link to start generating leads.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => {
                  const { device, os } = parseUserAgent(lead.userAgent);
                  const creditedAmount = creditedByLeadId.get(lead.id);
                  const payout = formatPublisherLeadPayout(lead, settings, creditedAmount);
                  const rejectReason = formatLeadRejectReason(lead);

                  return (
                    <TableRow
                      key={lead.id}
                      className="border-border transition-colors hover:bg-blue-50/40"
                    >
                      <TableCell className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
                        {formatUserDateTime(lead.createdAt, tz, "MMM d, yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4 font-mono text-xs text-muted-foreground">
                        {shortLeadId(lead.id)}
                      </TableCell>
                      <TableCell className={cn("whitespace-nowrap px-4 py-4 text-right text-sm", payout.className)}>
                        {payout.label}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4 text-sm text-foreground">
                        {extractLeadCountry(
                          lead.data,
                          lead.country,
                          lead.geoCountry,
                          lead.submissionMeta,
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4">
                        <LeadStatusBadge status={lead.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
                        {device}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
                        {os}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4 text-sm capitalize text-muted-foreground">
                        {lead.source ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4">
                        {lead.ctaClicked ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            Yes
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-slate-200">
                            No
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[220px] px-4 py-4 text-sm text-muted-foreground">
                        <p
                          className={cn(
                            "truncate",
                            lead.status === "REJECTED" && "text-red-700",
                          )}
                          title={rejectReason}
                        >
                          {rejectReason}
                        </p>
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
            perPage={meta.limit}
          />
        </Suspense>
      </PageSection>
    </div>
  );
}
