import { withAuth } from "@/lib/api-handler";
import { Errors } from "@/lib/errors";
import { requireSoloAdsAccess } from "@/lib/solo-ads-access";
import { setSoloProviderBlock } from "@/services/solo-campaign.service";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; code: string }> }) {
  return withAuth(async (session) => {
    if (session.viewAsMode) throw Errors.forbidden();
    await requireSoloAdsAccess(session.user.id);
    const { id, code } = await params;
    const publicCode = Number(code);
    if (!Number.isInteger(publicCode)) throw Errors.notFound("Provider");
    const body = (await request.json().catch(() => ({}))) as { blocked?: unknown };
    const data = await setSoloProviderBlock(session.user.id, id, publicCode, body.blocked !== false);
    return Response.json({ data });
  }, ["PUBLISHER"]);
}
