export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { formatUserDateTime } from "@/lib/user-timezone";
import { Webhook } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CpaPostbackDeliveryStatus } from "@prisma/client";
import { getSession } from "@/lib/session";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import { listPublisherPostbackDeliveries } from "@/services/publisher-postback.service";
import { PageSection } from "@/components/admin/page-section";
import { RoleHero } from "@/components/layout/role-hero";
import { PublisherInfoBanner } from "@/components/publisher/publisher-info-banner";
import { PublisherPostbackReportFilters } from "@/components/publisher/publisher-postback-report-filters";
import { AdvertiserLeadsTableFooter } from "@/components/advertiser/advertiser-leads-table-footer";
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
    q?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

const DELIVERY_STATUSES: CpaPostbackDeliveryStatus[] = [
  "PENDING",
  "SUCCESS",
  "FAILED",
  "SKIPPED",
];

function formatCurrency(amount: number | null) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

function statusClass(status: CpaPostbackDeliveryStatus) {
  if (status === "SUCCESS") return "font-medium text-emerald-700";
  if (status === "FAILED") return "font-medium text-red-700";
  if (status === "SKIPPED") return "font-medium text-slate-500";
  return "font-medium text-amber-700";
}

export default async function PublisherPostbackReportPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const tz = session.user.timezone;

  const params = await searchParams;
  const dateFrom = params.from ?? defaultCampaignDateFrom();
  const dateTo = params.to ?? defaultCampaignDateTo();
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const status = DELIVERY_STATUSES.includes(params.status as CpaPostbackDeliveryStatus)
    ? (params.status as CpaPostbackDeliveryStatus)
    : "all";

  const { data: rows, meta } = await listPublisherPostbackDeliveries({
    publisherId: session.user.id,
    search: params.q,
    status,
    dateFrom: new Date(dateFrom),
    dateTo: new Date(dateTo),
    page,
    limit: 10,
  });

  return (
    <div className="space-y-6">
      <RoleHero
        eyebrow="Publisher Portal"
        title="Postback Report"
        description="Review every postback we fired to your tracker, including HTTP status and payout."
      />

      <PublisherInfoBanner>
        Each paid lead fires your postback once. Test fires also appear here. Configure your URL on{" "}
        <Link
          href="/publisher/postback"
          className="font-medium text-[var(--theme-primary)] hover:underline"
        >
          Postback
        </Link>
        .
      </PublisherInfoBanner>

      <PageSection
        title="Delivery log"
        description="Outbound S2S postbacks for your account"
        icon={Webhook}
        gradient="leads"
      >
        <Suspense fallback={<div className="px-6 py-4 text-sm text-slate-500">Loading filters...</div>}>
          <PublisherPostbackReportFilters />
        </Suspense>

        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow
                className="border-none hover:bg-transparent"
                style={{ background: "var(--theme-primary-soft)" }}
              >
                <TableHead className="h-11 w-[150px] px-6 text-slate-600">Time</TableHead>
                <TableHead className="h-11 w-[120px] px-4 text-slate-600">Lead ID</TableHead>
                <TableHead className="h-11 w-[88px] px-4 text-right text-slate-600">Payout</TableHead>
                <TableHead className="h-11 min-w-0 px-4 text-slate-600">URL</TableHead>
                <TableHead className="h-11 w-[72px] px-4 text-slate-600">HTTP</TableHead>
                <TableHead className="h-11 w-[96px] px-4 text-slate-600">Result</TableHead>
                <TableHead className="h-11 w-[88px] px-6 text-slate-600">Attempts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="h-48 px-6 py-16 text-center">
                    <p className="text-base font-medium text-slate-500">No Data Found</p>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-slate-100 transition-colors hover:bg-blue-50/40"
                  >
                    <TableCell className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {formatUserDateTime(row.createdAt, tz, "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="truncate px-4 py-4 font-mono text-sm text-slate-800">
                      {row.event === "TEST" ? "TEST" : row.leadId ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm font-medium text-emerald-700">
                      {formatCurrency(row.payout)}
                    </TableCell>
                    <TableCell className="max-w-0 min-w-0 overflow-hidden px-4 py-4">
                      <span className="block truncate font-mono text-xs text-slate-600" title={row.url}>
                        {row.url}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {row.httpStatus || "—"}
                    </TableCell>
                    <TableCell className={`whitespace-nowrap px-4 py-4 text-sm ${statusClass(row.status)}`}>
                      {row.status}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-slate-700">{row.attempts}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <AdvertiserLeadsTableFooter
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          perPage={meta.limit}
        />
      </PageSection>
    </div>
  );
}
