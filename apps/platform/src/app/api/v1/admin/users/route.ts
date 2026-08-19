import { withAuth, parsePagination, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { canManagePortalUsers } from "@/lib/admin-portal";
import { errorResponse, Errors } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
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
  return withAuth(async (session) => {
    const body = await request.json();
    const userId = body?.userId as string | undefined;
    if (!userId) {
      return errorResponse(Errors.validation("userId is required", "userId"));
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!target) {
      return errorResponse(Errors.notFound("User"));
    }

    if (
      !canManagePortalUsers(
        session.user.role,
        session.user.staffMenuAccess,
        target.role,
      )
    ) {
      return errorResponse(Errors.forbidden());
    }

    const user = await updateUserStatus(userId, body.status, session.user.id);
    return Response.json({ data: user });
  }, ADMIN_PORTAL_ROLES);
}

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const role = body?.role === "ADVERTISER" ? "ADVERTISER" : "PUBLISHER";

      if (
        !canManagePortalUsers(
          session.user.role,
          session.user.staffMenuAccess,
          role,
        )
      ) {
        return errorResponse(Errors.forbidden());
      }

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
  }, ADMIN_PORTAL_ROLES);
}

export async function DELETE(request: Request) {
  return withAuth(async (session) => {
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

      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (!target) {
        return errorResponse(Errors.notFound("User"));
      }

      if (
        !canManagePortalUsers(
          session.user.role,
          session.user.staffMenuAccess,
          target.role,
        )
      ) {
        return errorResponse(Errors.forbidden());
      }

      const result = await deleteManagedUser(userId, session.user.id);
      return Response.json({ data: result });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
