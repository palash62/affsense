import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { adminOptinFunnelTemplateCreateSchema } from "@/lib/validations";
import {
  createOptinFunnelTemplateByAdmin,
  listOptinFunnelTemplatesForAdmin,
} from "@/services/optin-funnel.service";

export async function GET() {
  return withAuth(async () => {
    const data = await listOptinFunnelTemplatesForAdmin();
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const body = await request.json();
      const parsed = adminOptinFunnelTemplateCreateSchema.safeParse(body);
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

      const data = await createOptinFunnelTemplateByAdmin({
        name: parsed.data.name,
        primaryColor: parsed.data.primaryColor,
        secondaryColor: parsed.data.secondaryColor,
        sourceTemplateId: parsed.data.sourceTemplateId,
      });
      return Response.json({ data }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}

