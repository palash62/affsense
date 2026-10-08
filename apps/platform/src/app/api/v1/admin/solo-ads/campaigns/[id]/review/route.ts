import { withAuth } from "@/lib/api-handler";
import { ADMIN_PORTAL_ROLES } from "@/lib/admin-portal";
import { Errors } from "@/lib/errors";
import { assertSoloAdminAccess } from "@/lib/solo-ads-access";
import { reviewSoloCampaign, type AdminCampaignAction } from "@/services/solo-admin.service";

const ACTIONS: AdminCampaignAction[] = ["approve", "reject", "pause", "resume", "terminate", "priority", "verify_tracking"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (session) => {
    if (session.viewAsMode) throw Errors.forbidden();
    assertSoloAdminAccess(session);
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { action?: unknown; reason?: unknown; priority?: unknown };
    if (!ACTIONS.includes(body.action as AdminCampaignAction)) throw Errors.validation("Unknown action", "action");
    const data = await reviewSoloCampaign(session.user.id, id, {
      action: body.action as AdminCampaignAction,
      reason: typeof body.reason === "string" ? body.reason : null,
      priority: typeof body.priority === "number" ? body.priority : Number(body.priority),
    });
    return Response.json({ data: { id: data.id, status: data.status, priority: data.priority } });
  }, ADMIN_PORTAL_ROLES);
}
