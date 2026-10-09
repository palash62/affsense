import { withAuth } from "@/lib/api-handler";
import { Errors } from "@/lib/errors";
import { centsFromDollarsInput, requireSoloAdsAccess } from "@/lib/solo-ads-access";
import { submitSoloWiseDeposit } from "@/services/solo-wallet.service";

export async function POST(request: Request) {
  return withAuth(async (session) => {
    if (session.viewAsMode) throw Errors.forbidden();
    await requireSoloAdsAccess(session.user.id);
    const body = (await request.json().catch(() => ({}))) as { amount?: unknown; reference?: unknown; note?: unknown };
    const amountCents = centsFromDollarsInput(body.amount);
    if (!Number.isFinite(amountCents)) throw Errors.validation("Enter a valid amount", "amount");
    const deposit = await submitSoloWiseDeposit({
      publisherId: session.user.id,
      amountCents,
      reference: typeof body.reference === "string" ? body.reference : "",
      note: typeof body.note === "string" ? body.note : null,
    });
    return Response.json({ data: { id: deposit.id, status: deposit.status } }, { status: 201 });
  }, ["PUBLISHER"]);
}
