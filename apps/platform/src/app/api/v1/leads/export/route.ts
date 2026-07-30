import { format } from "date-fns";
import { withAuth } from "@/lib/api-handler";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import { leadsToCsv } from "@/lib/lead-csv";
import { listLeadsForExport, type AdvertiserLeadSort } from "@/services/lead.service";
import type { LeadStatus } from "@prisma/client";

function parseSort(sort: string | null): AdvertiserLeadSort | undefined {
  const valid: AdvertiserLeadSort[] = [
    "created_desc",
    "created_asc",
    "campaign_asc",
    "campaign_desc",
    "status_asc",
    "status_desc",
  ];
  return sort && valid.includes(sort as AdvertiserLeadSort) ? (sort as AdvertiserLeadSort) : undefined;
}

function parseStatus(status: string | null): LeadStatus | undefined {
  if (
    status &&
    ["CAPTURED", "VALIDATING", "PENDING", "APPROVED", "REJECTED", "PAID"].includes(status)
  ) {
    return status as LeadStatus;
  }
  return undefined;
}

export async function GET(request: Request) {
  return withAuth(async (session) => {
    const { searchParams } = new URL(request.url);
    const isAdmin = session.user.role === "ADMIN";

    const leads = await listLeadsForExport({
      advertiserId: isAdmin ? (searchParams.get("advertiserId") ?? undefined) : session.user.id,
      campaignId: searchParams.get("campaignId") ?? undefined,
      status: parseStatus(searchParams.get("status")),
      dateFrom: new Date(searchParams.get("from") ?? defaultCampaignDateFrom()),
      dateTo: new Date(searchParams.get("to") ?? defaultCampaignDateTo()),
      sort: parseSort(searchParams.get("sort")),
    });

    const csv = leadsToCsv(leads, {
      includeAdvertiser: isAdmin,
      timezone: session.user.timezone,
    });
    const filename = `leads-${format(new Date(), "yyyy-MM-dd")}.csv`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }, ["ADMIN", "ADVERTISER"]);
}
