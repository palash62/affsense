import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { smtpSettingsSchema } from "@/lib/validations";
import { getSmtpSettingsForAdmin, updateSmtpSettings } from "@/services/smtp-settings.service";
import { getEmailProviderStatus } from "@/services/email.service";

export async function GET() {
  return withAuth(async () => {
    const [data, providerStatus] = await Promise.all([
      getSmtpSettingsForAdmin(),
      getEmailProviderStatus(),
    ]);
    return Response.json({ data: { ...data, providerStatus } });
  }, ADMIN_PORTAL_ROLES);
}

export async function PATCH(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const parsed = smtpSettingsSchema.safeParse(body);

      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Please check the form and try again";
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message, status: 422 } },
          { status: 422 },
        );
      }

      const data = await updateSmtpSettings(parsed.data, session.user.id);
      const providerStatus = await getEmailProviderStatus();
      return Response.json({ data: { ...data, providerStatus } });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
