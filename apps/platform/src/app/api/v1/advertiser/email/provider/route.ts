import { withAuth } from "@/lib/api-handler";
import {
  getEmailProviderStatus,
  testSmtpConnection,
} from "@/services/email.service";
import { getMarketingProviderName } from "@/modules/email-marketing";

export async function GET() {
  return withAuth(async (session) => {
    const [transactional, marketingProvider] = await Promise.all([
      getEmailProviderStatus(),
      getMarketingProviderName(),
    ]);
    return Response.json({
      data: {
        ...transactional,
        marketingProvider,
      },
    });
  }, ["ADVERTISER"]);
}

export async function POST(request: Request) {
  return withAuth(async (session) => {
    const body = await request.json().catch(() => ({}));
    const to = typeof body.to === "string" ? body.to : session.user.email;
    const result = await testSmtpConnection(to);
    return Response.json({ data: result });
  }, ["ADVERTISER"]);
}
