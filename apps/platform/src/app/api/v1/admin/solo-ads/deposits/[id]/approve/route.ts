import { withRealAdmin } from "@/lib/api-handler";
import { Errors } from "@/lib/errors";
import { centsFromDollarsInput } from "@/lib/solo-ads-access";
import { approveSoloWiseDeposit } from "@/services/solo-wallet.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withRealAdmin(async (session) => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { amount?: unknown };
    let creditedCents: number | undefined;
    if (body.amount !== undefined && body.amount !== null && body.amount !== "") {
      creditedCents = centsFromDollarsInput(body.amount);
      if (!Number.isFinite(creditedCents)) throw Errors.validation("Enter a valid amount", "amount");
    }
    const deposit = await approveSoloWiseDeposit(id, session.user.id, creditedCents);
    return Response.json({ data: { id: deposit.id, status: deposit.status, amountCents: deposit.amountCents } });
  });
}
