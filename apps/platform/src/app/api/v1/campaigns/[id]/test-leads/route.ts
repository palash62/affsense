import { withAuth } from "@/lib/api-handler";
import { isAdminPortalRole } from "@/lib/admin-portal";
import { errorResponse, Errors } from "@/lib/errors";
import { campaignTestLeadSchema } from "@/lib/validations";
import { submitTestCampaignLead } from "@/services/lead.service";
import { getCampaignById } from "@/services/campaign.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withAuth(async (session) => {
    try {
      const campaign = await getCampaignById(id);
      if (!campaign) {
        throw Errors.notFound("Campaign");
      }

      if (session.user.role === "ADVERTISER" && campaign.advertiserId !== session.user.id) {
        throw Errors.forbidden();
      }

      const body = await request.json();
      const parsed = campaignTestLeadSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: parsed.error.issues[0]?.message ?? "Invalid input",
              status: 422,
            },
          },
          { status: 422 },
        );
      }

      const isAdmin = isAdminPortalRole(session.user.role);
      const lead = await submitTestCampaignLead({
        campaignId: id,
        advertiserId: campaign.advertiserId,
        actorId: session.user.id,
        actorReason: isAdmin ? "Admin campaign test lead" : "Advertiser campaign test lead",
        data: parsed.data.data,
      });

      return Response.json(
        {
          lead: {
            id: lead.id,
            status: lead.status,
            isTest: true,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER", "ADMIN"]);
}
