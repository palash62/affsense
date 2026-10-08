import { withAuth } from "@/lib/api-handler";
import { Errors } from "@/lib/errors";
import { requireSoloAdsAccess } from "@/lib/solo-ads-access";
import { changeSoloCampaignStatus, type SoloCampaignAction } from "@/services/solo-campaign.service";

const ACTIONS: SoloCampaignAction[] = ["submit", "pause", "resume"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (session) => {
    if (session.viewAsMode) throw Errors.forbidden();
    await requireSoloAdsAccess(session.user.id);
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { action?: unknown };
    if (!ACTIONS.includes(body.action as SoloCampaignAction)) throw Errors.validation("Unknown action", "action");
    const data = await changeSoloCampaignStatus(session.user.id, id, body.action as SoloCampaignAction);
    return Response.json({ data: { id: data.id, status: data.status } });
  }, ["PUBLISHER"]);
}
