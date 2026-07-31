import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { adminOptinFunnelTemplateUpdateSchema } from "@/lib/validations";
import {
  deleteOptinFunnelTemplateByAdmin,
  getOptinFunnelTemplateByAdmin,
  updateOptinFunnelTemplateByAdmin,
} from "@/services/optin-funnel.service";
import type { CraftSerializedState } from "@/modules/page-builder/types/page-document";
import type { ThemeJson } from "@/modules/page-builder/lib/theme";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withAuth(async () => {
    try {
      const data = await getOptinFunnelTemplateByAdmin(id);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADMIN"]);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withAuth(async () => {
    try {
      const body = await request.json();
      const parsed = adminOptinFunnelTemplateUpdateSchema.safeParse(body);
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
      const data = await updateOptinFunnelTemplateByAdmin(id, {
        name: parsed.data.name,
        craftState: parsed.data.craftState as CraftSerializedState | undefined,
        themeJson: parsed.data.themeJson as ThemeJson | undefined,
        thankYouEnabled: parsed.data.thankYouEnabled,
        destinationUrl: parsed.data.destinationUrl,
        thankYouCraftState: (parsed.data.thankYouCraftState as CraftSerializedState | null | undefined) ?? undefined,
        thankYouThemeJson: parsed.data.thankYouThemeJson as ThemeJson | undefined,
        thankYouPixelHtml: parsed.data.thankYouPixelHtml,
        thankYouUseCampaignPixel: parsed.data.thankYouUseCampaignPixel,
        step: parsed.data.step,
        autosave: parsed.data.autosave,
        isPublished: parsed.data.isPublished,
      });
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADMIN"]);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withAuth(async () => {
    try {
      const data = await deleteOptinFunnelTemplateByAdmin(id);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADMIN"]);
}
