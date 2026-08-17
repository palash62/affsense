import { AppError, errorResponse } from "@/lib/errors";
import { withAuth, parsePagination } from "@/lib/api-handler";
import { isAdminPortalRole } from "@/lib/admin-portal";
import { listLeads, PUBLISHER_EXCLUDED_LEAD_STATUSES, updateLeadStatus } from "@/services/lead.service";

export async function GET(request: Request) {
  return withAuth(async (session) => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);

    const result = await listLeads({
      campaignId: searchParams.get("campaignId") ?? undefined,
      status: (searchParams.get("status") as never) ?? undefined,
      publisherId:
        session.user.role === "PUBLISHER"
          ? session.user.id
          : (searchParams.get("publisherId") ?? undefined),
      advertiserId: session.user.role === "ADVERTISER" ? session.user.id : undefined,
      page,
      limit,
      ...(session.user.role === "PUBLISHER"
        ? { excludeStatuses: [...PUBLISHER_EXCLUDED_LEAD_STATUSES] }
        : {}),
    });

    return Response.json(result);
  });
}

export async function PATCH(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const { leadId, leadIds, status, reason } = body as {
        leadId?: string;
        leadIds?: unknown;
        status?: string;
        reason?: string;
      };

      if (!["APPROVED", "REJECTED"].includes(status ?? "")) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Invalid status", status: 422 } },
          { status: 422 },
        );
      }

      const isAdmin = isAdminPortalRole(session.user.role);
      const statusValue = status as "APPROVED" | "REJECTED";

      if (Array.isArray(leadIds)) {
        if (statusValue !== "REJECTED") {
          return Response.json(
            {
              error: {
                code: "VALIDATION_ERROR",
                message: "Bulk updates only support REJECTED status",
                status: 422,
              },
            },
            { status: 422 },
          );
        }

        const ids = leadIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
        if (ids.length === 0) {
          return Response.json(
            { error: { code: "VALIDATION_ERROR", message: "No leads selected", status: 422 } },
            { status: 422 },
          );
        }

        const failed: { leadId: string; message: string }[] = [];
        let rejected = 0;

        for (const id of ids) {
          try {
            await updateLeadStatus(id, "REJECTED", session.user.id, reason, { isAdmin });
            rejected += 1;
          } catch (error) {
            failed.push({
              leadId: id,
              message: error instanceof AppError ? error.message : "Failed to reject lead",
            });
          }
        }

        if (rejected === 0) {
          return Response.json(
            {
              error: {
                code: "VALIDATION_ERROR",
                message: failed[0]?.message ?? "Failed to reject leads",
                status: 422,
              },
              failed,
            },
            { status: 422 },
          );
        }

        return Response.json({ rejected, failed });
      }

      if (!leadId || typeof leadId !== "string") {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "leadId is required", status: 422 } },
          { status: 422 },
        );
      }

      const lead = await updateLeadStatus(leadId, statusValue, session.user.id, reason, {
        isAdmin,
      });
      return Response.json({ data: lead });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER", "ADMIN"]);
}
