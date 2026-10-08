import { withAuth } from "@/lib/api-handler";
import { requireSoloAdsAccess } from "@/lib/solo-ads-access";
import { soloCsvCell } from "@/components/solo-ads/solo-shared";
import { getSoloPublisherReport } from "@/services/solo-report.service";

export async function GET(request: Request) {
  return withAuth(async (session) => {
    await requireSoloAdsAccess(session.user.id);
    const url = new URL(request.url);
    const report = await getSoloPublisherReport(session.user.id, {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      groupBy: url.searchParams.get("groupBy"),
      campaignId: url.searchParams.get("campaignId"),
    });
    const header = [
      report.groupBy === "day" ? "Date" : report.groupBy === "provider" ? "Provider" : "Campaign",
      "Clicks routed",
      "Paid clicks",
      "Invalid clicks",
      "Spend (USD)",
      "Leads",
      "Conversions",
      "Commission (USD)",
      "Reversed (USD)",
      "Net (USD)",
    ];
    const lines = [...report.rows, report.totals].map((r) =>
      [
        r.label,
        r.clicks,
        r.billedClicks,
        r.invalidClicks,
        r.spendCents / 100,
        r.leads,
        r.conversions,
        r.commissionCents / 100,
        r.reversedCents / 100,
        (r.commissionCents - r.spendCents) / 100,
      ]
        .map(soloCsvCell)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="solo-ads-${report.groupBy}-${report.range.from}-${report.range.to}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }, ["PUBLISHER"]);
}
