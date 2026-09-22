import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import {
  getPlatformSettingsResponse,
  updatePlatformSettings,
} from "@/services/admin.service";

export async function GET() {
  return withAuth(async () => {
    const data = await getPlatformSettingsResponse();
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}

export async function PATCH(request: Request) {
  return withAuth(async (session) => {
    const body = await request.json();

    if (
      body.tier1PayoutMin !== undefined &&
      body.tier1PayoutMax !== undefined &&
      body.tier1PayoutMin > body.tier1PayoutMax
    ) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Tier 1 min cannot exceed max", status: 422 } },
        { status: 422 },
      );
    }
    if (
      body.tier2PayoutMin !== undefined &&
      body.tier2PayoutMax !== undefined &&
      body.tier2PayoutMin > body.tier2PayoutMax
    ) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Tier 2 min cannot exceed max", status: 422 } },
        { status: 422 },
      );
    }
    if (
      body.tier3PayoutMin !== undefined &&
      body.tier3PayoutMax !== undefined &&
      body.tier3PayoutMin > body.tier3PayoutMax
    ) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Tier 3 min cannot exceed max", status: 422 } },
        { status: 422 },
      );
    }

    if (body.globalLinkUrl) {
      try {
        const parsed = new URL(body.globalLinkUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error("invalid protocol");
        }
      } catch {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Enter a valid global link URL", status: 422 } },
          { status: 422 },
        );
      }
    }

    if (
      body.minPayoutAmount !== undefined &&
      (!Number.isFinite(Number(body.minPayoutAmount)) || Number(body.minPayoutAmount) < 1)
    ) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Publisher minimum withdraw must be at least $1",
            status: 422,
          },
        },
        { status: 422 },
      );
    }

    if (
      body.minAdvertiserWithdrawAmount !== undefined &&
      (!Number.isFinite(Number(body.minAdvertiserWithdrawAmount)) ||
        Number(body.minAdvertiserWithdrawAmount) < 1)
    ) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Advertiser minimum withdraw must be at least $1",
            status: 422,
          },
        },
        { status: 422 },
      );
    }

    await updatePlatformSettings(body, session.user.id);
    const data = await getPlatformSettingsResponse();
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}
