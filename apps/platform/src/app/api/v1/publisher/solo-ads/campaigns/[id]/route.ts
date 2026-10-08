import { withAuth } from "@/lib/api-handler";
import { Errors } from "@/lib/errors";
import { requireSoloAdsAccess } from "@/lib/solo-ads-access";
import { deleteSoloCampaign, getOwnedSoloCampaign, updateSoloCampaign } from "@/services/solo-campaign.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  return withAuth(async (session) => {
    await requireSoloAdsAccess(session.user.id);
    const { id } = await params;
    return Response.json({ data: await getOwnedSoloCampaign(session.user.id, id) });
  }, ["PUBLISHER"]);
}

export async function PATCH(request: Request, { params }: Ctx) {
  return withAuth(async (session) => {
    if (session.viewAsMode) throw Errors.forbidden();
    await requireSoloAdsAccess(session.user.id);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    return Response.json({ data: await updateSoloCampaign(session.user.id, id, body) });
  }, ["PUBLISHER"]);
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return withAuth(async (session) => {
    if (session.viewAsMode) throw Errors.forbidden();
    await requireSoloAdsAccess(session.user.id);
    const { id } = await params;
    await deleteSoloCampaign(session.user.id, id);
    return Response.json({ data: { id } });
  }, ["PUBLISHER"]);
}
