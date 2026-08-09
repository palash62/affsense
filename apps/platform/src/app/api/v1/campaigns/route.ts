import { withAuth, parsePagination } from "@/lib/api-handler";
import { isAdminPortalRole } from "@/lib/admin-portal";
import { errorResponse } from "@/lib/errors";
import { adminCreateCampaignSchema, campaignSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";
import { createCampaign, listCampaigns } from "@/services/campaign.service";
import { notifyAdminAlert } from "@/services/notify.service";
import {
  linkOptinPageToCampaign,
  resolveOptinPageDestination,
} from "@/services/optin-page.service";

function resolveRequestBaseUrl(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function createCampaignWithOptinPage(input: {
  request: Request;
  advertiserId: string;
  optinPageId: string;
  vertical?: string;
  campaignData: Omit<Parameters<typeof createCampaign>[0], "advertiserId" | "targeting" | "description"> & {
    description?: string;
    targeting?: Record<string, unknown>;
  };
}) {
  const baseUrl = resolveRequestBaseUrl(input.request);
  const { page, destinationUrl } = await resolveOptinPageDestination(
    input.optinPageId,
    input.advertiserId,
    baseUrl,
  );

  const campaign = await createCampaign({
    ...input.campaignData,
    advertiserId: input.advertiserId,
    publisherAccess: "OPEN",
    autoApprove: true,
    description: input.campaignData.description ?? `Optin page: ${page.title}`,
    targeting: {
      ...(input.campaignData.targeting ?? {}),
      destinationUrl,
      optinPageId: page.id,
      optinSlug: page.slug,
      ...(input.vertical ? { vertical: input.vertical } : {}),
    },
  });

  await linkOptinPageToCampaign(page.id, campaign.id, input.advertiserId);

  return campaign;
}

export async function GET(request: Request) {
  return withAuth(async (session) => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);

    if (session.user.role === "ADVERTISER") {
      const result = await listCampaigns({
        advertiserId: session.user.id,
        status: (searchParams.get("status") as never) ?? undefined,
        page,
        limit,
        includeAdvertiserEmail: true,
      });
      return Response.json(result);
    }

    if (session.user.role === "PUBLISHER") {
      const result = await listCampaigns({
        publisherId: session.user.id,
        status: (searchParams.get("status") as never) ?? undefined,
        page,
        limit,
        includeAdvertiserEmail: false,
      });
      return Response.json(result);
    }

    if (isAdminPortalRole(session.user.role)) {
      const result = await listCampaigns({
        advertiserId: searchParams.get("advertiserId") ?? undefined,
        status: (searchParams.get("status") as never) ?? undefined,
        page,
        limit,
        includeAdvertiserEmail: true,
      });
      return Response.json(result);
    }

    return Response.json({ error: { code: "PERMISSION_DENIED", status: 403 } }, { status: 403 });
  }, ["ADMIN", "ADVERTISER", "PUBLISHER"]);
}

export async function POST(request: Request) {
  return withAuth(async (session) => {
    if (session.user.role !== "ADVERTISER" && !isAdminPortalRole(session.user.role)) {
      return Response.json({ error: { code: "PERMISSION_DENIED", status: 403 } }, { status: 403 });
    }

    try {
      const body = await request.json();
      const isAdmin = isAdminPortalRole(session.user.role);

      if (isAdmin) {
        const parsed = adminCreateCampaignSchema.safeParse(body);
        if (!parsed.success) {
          const message = parsed.error.issues[0]?.message ?? parsed.error.message;
          return Response.json(
            { error: { code: "VALIDATION_ERROR", message, status: 422 } },
            { status: 422 },
          );
        }

        const { advertiserId, optinPageId, vertical, ...campaignData } = parsed.data;
        const advertiser = await prisma.user.findFirst({
          where: { id: advertiserId, role: "ADVERTISER" },
          select: { id: true },
        });
        if (!advertiser) {
          return Response.json(
            { error: { code: "NOT_FOUND", message: "Advertiser not found", status: 404 } },
            { status: 404 },
          );
        }

        const campaign = await createCampaignWithOptinPage({
          request,
          advertiserId,
          optinPageId,
          vertical,
          campaignData: {
            ...campaignData,
            status: campaignData.status ?? "ACTIVE",
            fields: campaignData.fields,
          },
        });

        return Response.json({ data: campaign }, { status: 201 });
      }

      const parsed = campaignSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: parsed.error.message, status: 422 } },
          { status: 422 },
        );
      }

      const optinPageId = typeof body.optinPageId === "string" ? body.optinPageId : "";
      if (!optinPageId) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Select an optin page", status: 422 } },
          { status: 422 },
        );
      }

      const requestedStatus = parsed.data.status;
      if (requestedStatus === "ACTIVE" || requestedStatus === "PAUSED") {
        return Response.json(
          {
            error: {
              code: "PERMISSION_DENIED",
              message: "Advertisers cannot create campaigns as active or paused",
              status: 403,
            },
          },
          { status: 403 },
        );
      }

      const finalStatus = requestedStatus === "DRAFT" ? "DRAFT" : "PENDING";

      const campaign = await createCampaignWithOptinPage({
        request,
        advertiserId: session.user.id,
        optinPageId,
        campaignData: {
          ...parsed.data,
          status: finalStatus,
        },
      });

      if (finalStatus === "PENDING") {
        void notifyAdminAlert({
          title: "Campaign pending review",
          message: `${session.user.name} submitted "${campaign.name}" for approval.`,
          actionPath: "/admin/campaigns",
          metadata: { campaignId: campaign.id, advertiserId: session.user.id },
        });
      }

      return Response.json({ data: campaign }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER", "ADMIN"]);
}
