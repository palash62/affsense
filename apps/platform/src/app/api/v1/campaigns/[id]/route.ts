import { withAuth } from "@/lib/api-handler";
import { isAdminPortalRole } from "@/lib/admin-portal";
import { errorResponse, Errors } from "@/lib/errors";
import { getActorId } from "@/lib/session";
import { adminUpdateCampaignSchema } from "@/lib/validations";
import {
  deleteCampaignByAdmin,
  getCampaignById,
  updateCampaignByAdmin,
} from "@/services/campaign.service";

function resolveRequestBaseUrl(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(async (session) => {
    const campaign = await getCampaignById(id);
    if (!campaign) return errorResponse(Errors.notFound("Campaign"));

    if (session.user.role === "ADVERTISER" && campaign.advertiserId !== session.user.id) {
      return errorResponse(Errors.forbidden());
    }

    if (session.user.role === "PUBLISHER") {
      const assigned =
        campaign.publisherAccess === "OPEN" ||
        campaign.publisherCampaigns.some((row) => row.publisher.id === session.user.id);
      if (!assigned) {
        return errorResponse(Errors.forbidden());
      }
      const { email: _email, ...advertiserSafe } = campaign.advertiser;
      return Response.json({
        data: {
          ...campaign,
          advertiser: advertiserSafe,
        },
      });
    }

    if (!isAdminPortalRole(session.user.role) && session.user.role !== "ADVERTISER") {
      return errorResponse(Errors.forbidden());
    }

    return Response.json({ data: campaign });
  }, ["ADMIN", "ADVERTISER", "PUBLISHER"]);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const parsed = adminUpdateCampaignSchema.safeParse(body);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Invalid campaign update";
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message, status: 422 } },
          { status: 422 },
        );
      }

      const campaign = await getCampaignById(id);
      if (!campaign) return errorResponse(Errors.notFound("Campaign"));

      if (
        session.user.role === "ADVERTISER" &&
        campaign.advertiserId !== session.user.id
      ) {
        return errorResponse(Errors.forbidden());
      }

      const updated = await updateCampaignByAdmin(id, parsed.data, getActorId(session), {
        baseUrl: resolveRequestBaseUrl(request),
        actorRole: isAdminPortalRole(session.user.role) ? "ADMIN" : "ADVERTISER",
      });
      return Response.json({ data: updated });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER", "ADMIN"]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(async (session) => {
    if (session.impersonatorId) {
      return errorResponse(Errors.forbidden());
    }

    try {
      const campaign = await getCampaignById(id);
      if (!campaign) return errorResponse(Errors.notFound("Campaign"));
      if (
        session.user.role === "ADVERTISER" &&
        campaign.advertiserId !== session.user.id
      ) {
        return errorResponse(Errors.forbidden());
      }
      await deleteCampaignByAdmin(id, session.user.id);
      return Response.json({ data: { deleted: true } });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER", "ADMIN"]);
}
