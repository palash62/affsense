import { withAuth, withRealAdmin, parsePagination, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { adminCreateAdvertiserSchema, adminCreatePublisherSchema } from "@/lib/validations";
import {
  createAdvertiserAccount,
  createPublisherAccount,
  deleteManagedUser,
  listUsers,
  updateUserStatus,
} from "@/services/admin.service";
import type { UserRole, UserStatus } from "@prisma/client";

export async function GET(request: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);

    const result = await listUsers({
      role: (searchParams.get("role") as UserRole) ?? undefined,
      status: (searchParams.get("status") as UserStatus) ?? undefined,
      search: searchParams.get("q") ?? undefined,
      dateFrom: searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined,
      dateTo: searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined,
      page,
      limit,
    });

    return Response.json(result);
  }, ADMIN_PORTAL_ROLES);
}

export async function PATCH(request: Request) {
  return withRealAdmin(async (session) => {
    const body = await request.json();
    const user = await updateUserStatus(body.userId, body.status, session.user.id);
    return Response.json({ data: user });
  });
}

export async function POST(request: Request) {
  return withRealAdmin(async () => {
    try {
      const body = await request.json();
      const role = body?.role === "ADVERTISER" ? "ADVERTISER" : "PUBLISHER";

      if (role === "ADVERTISER") {
        const parsed = adminCreateAdvertiserSchema.safeParse(body);
        if (!parsed.success) {
          const message = parsed.error.issues[0]?.message ?? "Please check the form and try again";
          return Response.json(
            { error: { code: "VALIDATION_ERROR", message, status: 422 } },
            { status: 422 },
          );
        }
        const result = await createAdvertiserAccount(parsed.data);
        return Response.json({ data: result }, { status: 201 });
      }

      const parsed = adminCreatePublisherSchema.safeParse(body);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Please check the form and try again";
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message, status: 422 } },
          { status: 422 },
        );
      }

      const result = await createPublisherAccount(parsed.data);
      return Response.json({ data: result }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export async function DELETE(request: Request) {
  return withRealAdmin(async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      let userId = searchParams.get("userId") ?? undefined;

      if (!userId) {
        const body = await request.json().catch(() => null);
        userId = body?.userId;
      }

      if (!userId) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "userId is required", status: 422 } },
          { status: 422 },
        );
      }

      const result = await deleteManagedUser(userId, session.user.id);
      return Response.json({ data: result });
    } catch (error) {
      return errorResponse(error);
    }
  });
}
