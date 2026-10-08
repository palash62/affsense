import { withRealAdmin } from "@/lib/api-handler";
import { Errors } from "@/lib/errors";
import { centsFromDollarsInput } from "@/lib/solo-ads-access";
import { adminAdjustSoloWallet } from "@/services/solo-wallet.service";

export async function POST(request: Request) {
  return withRealAdmin(async (session) => {
    const body = (await request.json().catch(() => ({}))) as {
      publisherId?: unknown;
      amount?: unknown;
      reason?: unknown;
      requestKey?: unknown;
    };
    const amountCents = centsFromDollarsInput(body.amount);
    if (!Number.isFinite(amountCents)) throw Errors.validation("Enter a valid amount", "amount");
    const entry = await adminAdjustSoloWallet({
      adminId: session.user.id,
      publisherId: typeof body.publisherId === "string" ? body.publisherId : "",
      amountCents,
      reason: typeof body.reason === "string" ? body.reason : "",
      requestKey: typeof body.requestKey === "string" && body.requestKey ? body.requestKey : crypto.randomUUID(),
    });
    return Response.json({ data: { id: entry.id, balanceAfterCents: entry.balanceAfterCents } });
  });
}
