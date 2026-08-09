import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { getFraudConfig, updateFraudConfig } from "@/modules/fraud";

export async function GET() {
  return withAuth(async () => {
    const data = await getFraudConfig();
    const providers = {
      ipApiConfigured: Boolean(process.env.FRAUD_IP_API_KEY?.trim()),
      emailApiConfigured: Boolean(process.env.FRAUD_EMAIL_API_KEY?.trim()),
    };
    return Response.json({ data, providers });
  }, ADMIN_PORTAL_ROLES);
}

export async function PATCH(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const data = await updateFraudConfig(body, session.user.id);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
