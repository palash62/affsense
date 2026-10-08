import { withAuth } from "@/lib/api-handler";
import { Errors } from "@/lib/errors";
import { requireSoloAdsAccess } from "@/lib/solo-ads-access";
import { createSoloCampaign, listSoloCampaigns } from "@/services/solo-campaign.service";

export async function GET() {
  return withAuth(async (session) => {
    await requireSoloAdsAccess(session.user.id);
    return Response.json({ data: await listSoloCampaigns(session.user.id) });
  }, ["PUBLISHER"]);
}

export async function POST(request: Request) {
  return withAuth(async (session) => {
    if (session.viewAsMode) throw Errors.forbidden();
    await requireSoloAdsAccess(session.user.id);
    const body = await request.json().catch(() => ({}));
    const data = await createSoloCampaign(session.user.id, body);
    return Response.json({ data }, { status: 201 });
  }, ["PUBLISHER"]);
}
