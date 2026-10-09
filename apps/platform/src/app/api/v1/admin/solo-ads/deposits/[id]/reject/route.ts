import { withRealAdmin } from "@/lib/api-handler";
import { rejectSoloWiseDeposit } from "@/services/solo-wallet.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withRealAdmin(async (session) => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    const deposit = await rejectSoloWiseDeposit(id, session.user.id, typeof body.reason === "string" ? body.reason : "");
    return Response.json({ data: { id: deposit.id, status: deposit.status } });
  });
}
