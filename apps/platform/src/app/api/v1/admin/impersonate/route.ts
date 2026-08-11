import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { canImpersonateUser } from "@/lib/admin-portal";
import { errorResponse, Errors } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { createImpersonationToken, createRestoreToken } from "@/services/impersonation.service";

export async function POST(request: Request) {
  return withAuth(async (session) => {
    if (session.impersonatorId) {
      return errorResponse(Errors.forbidden());
    }

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
      return errorResponse(Errors.notFound("User not found"));
    }

    if (
      !canImpersonateUser(
        session.user.role,
        session.user.staffMenuAccess,
        target.role,
      )
    ) {
      return errorResponse(Errors.forbidden());
    }

    const result = await createImpersonationToken(session.user.id, userId);
    return Response.json({ data: result });
  }, ADMIN_PORTAL_ROLES);
}

export async function DELETE() {
  return withAuth(async (session) => {
    const adminId = session.impersonatorId;
    if (!adminId) {
      return errorResponse(Errors.validation("Not currently impersonating"));
    }

    const result = await createRestoreToken(adminId);
    return Response.json({ data: result });
  });
}
