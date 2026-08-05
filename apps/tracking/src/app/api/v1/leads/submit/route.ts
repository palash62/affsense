import { buildPlatformLeadSubmitUrl, getInternalServiceToken } from "@cpl/shared";
import { errorResponse } from "@/lib/errors";
import { leadSubmitSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";
import { parseUserAgent } from "@/lib/parse-user-agent";
import { campaignAcceptsDeviceOs } from "@/lib/smart-link-rotation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = leadSubmitSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.message, status: 422 } },
        { status: 422 },
      );
    }

    const token = getInternalServiceToken();
    if (!token) {
      return Response.json(
        { error: { code: "CONFIG_ERROR", message: "Service token not configured", status: 500 } },
        { status: 500 },
      );
    }

    const userAgent = request.headers.get("user-agent") ?? "";
    const trackingLink = await prisma.trackingLink.findUnique({
      where: { slug: parsed.data.slug },
      select: {
        campaign: {
          select: { status: true, targeting: true },
        },
      },
    });

    if (!trackingLink || trackingLink.campaign.status !== "ACTIVE") {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Campaign not found", status: 404 } },
        { status: 404 },
      );
    }

    const visitor = parseUserAgent(userAgent);
    if (!campaignAcceptsDeviceOs(trackingLink.campaign.targeting, visitor)) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `This campaign does not accept ${visitor.device} / ${visitor.os} traffic.`,
            status: 422,
            field: "device",
          },
        },
        { status: 422 },
      );
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const platformRes = await fetch(buildPlatformLeadSubmitUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Token": token,
        "X-Forwarded-For": ip,
        "User-Agent": userAgent,
      },
      body: JSON.stringify(parsed.data),
    });

    const result = await platformRes.json();
    return Response.json(result, { status: platformRes.status });
  } catch (error) {
    return errorResponse(error);
  }
}
