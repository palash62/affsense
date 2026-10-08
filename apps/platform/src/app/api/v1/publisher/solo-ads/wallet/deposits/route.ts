import { withAuth } from "@/lib/api-handler";
import { Errors } from "@/lib/errors";
import { centsFromDollarsInput, requireSoloAdsAccess } from "@/lib/solo-ads-access";
import { createSoloDepositIntent } from "@/services/solo-wallet.service";

export async function POST(request: Request) {
  return withAuth(async (session) => {
    if (session.viewAsMode) throw Errors.forbidden();
    await requireSoloAdsAccess(session.user.id);
    const body = (await request.json().catch(() => ({}))) as { amount?: unknown };
    const amountCents = centsFromDollarsInput(body.amount);
    if (!Number.isFinite(amountCents)) throw Errors.validation("Enter a valid amount", "amount");
    const data = await createSoloDepositIntent(session.user.id, amountCents);
    return Response.json({ data });
  }, ["PUBLISHER"]);
}
