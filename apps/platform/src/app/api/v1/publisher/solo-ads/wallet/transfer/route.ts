import { withAuth } from "@/lib/api-handler";
import { Errors } from "@/lib/errors";
import { centsFromDollarsInput, requireSoloAdsAccess } from "@/lib/solo-ads-access";
import { transferEarningsToSoloWallet } from "@/services/solo-wallet.service";

export async function POST(request: Request) {
  return withAuth(async (session) => {
    if (session.viewAsMode) throw Errors.forbidden();
    await requireSoloAdsAccess(session.user.id);
    const body = (await request.json().catch(() => ({}))) as { amount?: unknown; requestKey?: unknown };
    const amountCents = centsFromDollarsInput(body.amount);
    if (!Number.isFinite(amountCents)) throw Errors.validation("Enter a valid amount", "amount");
    const entry = await transferEarningsToSoloWallet(
      session.user.id,
      amountCents,
      typeof body.requestKey === "string" ? body.requestKey : "",
    );
    return Response.json({ data: { id: entry.id, balanceAfterCents: entry.balanceAfterCents } });
  }, ["PUBLISHER"]);
}
