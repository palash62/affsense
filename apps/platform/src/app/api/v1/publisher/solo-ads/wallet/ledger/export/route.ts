import { withAuth } from "@/lib/api-handler";
import { requireSoloAdsAccess } from "@/lib/solo-ads-access";
import { soloCsvCell } from "@/components/solo-ads/solo-shared";
import { listSoloLedger } from "@/services/solo-wallet.service";

const TYPES = new Set(["DEPOSIT", "EARNINGS_TRANSFER", "CHARGE", "REFUND", "ADJUSTMENT", "CHARGEBACK", "REVERSAL"]);

export async function GET(request: Request) {
  return withAuth(async (session) => {
    await requireSoloAdsAccess(session.user.id);
    const typeParam = new URL(request.url).searchParams.get("type");
    const type = typeParam && TYPES.has(typeParam) ? typeParam : null;
    const lines = ["Date (UTC),Type,Amount (USD),Balance after (USD),Reference,Details"];
    for (let page = 1; page <= 100; page++) {
      const { rows, totalPages } = await listSoloLedger(session.user.id, { page, limit: 100, type });
      for (const r of rows) {
        lines.push(
          [r.createdAt.toISOString(), r.type, r.amountCents / 100, r.balanceAfterCents / 100, r.sourceId ?? "", r.reason ?? r.sourceType ?? ""]
            .map(soloCsvCell)
            .join(","),
        );
      }
      if (page >= totalPages) break;
    }
    return new Response(lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="solo-ads-wallet${type ? `-${type.toLowerCase()}` : ""}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }, ["PUBLISHER"]);
}
