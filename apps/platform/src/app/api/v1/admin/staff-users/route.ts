import { withRealAdmin, parsePagination } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import {
  adminCreateStaffUserSchema,
} from "@/lib/validations";
import {
  createPlatformManagerAccount,
  listPlatformManagers,
} from "@/services/admin.service";
import { parseStaffMenuAccess } from "@/lib/admin-portal";
import type { UserStatus } from "@prisma/client";

export async function GET(request: Request) {
  return withRealAdmin(async () => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const status = searchParams.get("status") as UserStatus | undefined;
    const search = searchParams.get("q") ?? undefined;
    const result = await listPlatformManagers({
      page,
      limit,
      status: status || undefined,
      search,
    });
    return Response.json({
      data: result.data.map((u) => ({
        ...u,
        staffMenuAccess: parseStaffMenuAccess(u.staffMenuAccess),
      })),
      meta: result.meta,
    });
  });
}

export async function POST(request: Request) {
  return withRealAdmin(async () => {
    try {
      const body = await request.json();
      const parsed = adminCreateStaffUserSchema.safeParse(body);
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
      const result = await createPlatformManagerAccount(parsed.data);
      return Response.json({ data: result }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  });
}
