import { withAuth } from "@/lib/api-handler";
import { requireSoloAdsAccess } from "@/lib/solo-ads-access";
import { refreshSoloDeposit } from "@/services/solo-wallet.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (session) => {
    await requireSoloAdsAccess(session.user.id);
    const { id } = await params;
    const deposit = await refreshSoloDeposit(session.user.id, id);
    return Response.json({ data: { id: deposit.id, status: deposit.status, amountCents: deposit.amountCents } });
  }, ["PUBLISHER"]);
}
