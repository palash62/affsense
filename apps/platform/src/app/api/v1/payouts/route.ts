import { withAuth, parsePagination, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { isAdminPortalRole } from "@/lib/admin-portal";
import { errorResponse } from "@/lib/errors";
import { payoutRequestSchema } from "@/lib/validations";
import { approvePayout, rejectPayout, listPayouts, requestPayout } from "@/services/payout.service";

export async function GET(request: Request) {
  return withAuth(async (session) => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);

    if (session.user.role === "PUBLISHER") {
      const result = await listPayouts({
        publisherId: session.user.id,
        kind: "PUBLISHER",
        status: searchParams.get("status") ?? undefined,
        page,
        limit,
      });
      return Response.json(result);
    }

    if (isAdminPortalRole(session.user.role)) {
      const result = await listPayouts({
        publisherId: searchParams.get("publisherId") ?? undefined,
        status: searchParams.get("status") ?? undefined,
        page,
        limit,
      });
      return Response.json(result);
    }

    return Response.json({ error: { code: "PERMISSION_DENIED", status: 403 } }, { status: 403 });
  }, ["PUBLISHER", "ADMIN"]);
}

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const parsed = payoutRequestSchema.safeParse(body);

      if (!parsed.success) {
        return Response.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message, status: 422 } }, { status: 422 });
      }

      const payout = await requestPayout(
        session.user.id,
        parsed.data.amount,
        parsed.data.method,
        parsed.data.paymentDetails,
        parsed.data.idempotencyKey,
      );

      return Response.json({ data: payout }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["PUBLISHER"]);
}

export async function PATCH(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();

      if (body.action === "reject") {
        const reason = typeof body.reason === "string" ? body.reason.trim() : "";
        if (!reason) {
          return Response.json(
            { error: { code: "VALIDATION_ERROR", message: "Rejection note is required", status: 422 } },
            { status: 422 },
          );
        }
        const payout = await rejectPayout(body.payoutId, session.user.id, reason);
        return Response.json({ data: payout });
      }

      const payout = await approvePayout(body.payoutId, session.user.id);
      return Response.json({ data: payout });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
