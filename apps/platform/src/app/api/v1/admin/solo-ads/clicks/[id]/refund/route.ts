import { withRealAdmin } from "@/lib/api-handler";
import { adminRefundSoloClick } from "@/services/solo-admin.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withRealAdmin(async (session) => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    await adminRefundSoloClick(session.user.id, id, typeof body.reason === "string" ? body.reason : "");
    return Response.json({ data: { id, billingStatus: "REFUNDED" } });
  });
}
