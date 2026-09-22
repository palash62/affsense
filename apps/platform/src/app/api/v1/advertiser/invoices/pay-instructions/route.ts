import { withAuth } from "@/lib/api-handler";
import { canAdvertiserAccessCpaOffers } from "@/lib/cpa-offers-access";
import { errorResponse, Errors } from "@/lib/errors";
import { adminPayInstructionsFromConfig } from "@/lib/platform-settings";
import { getPlatformSettings } from "@/services/wallet.service";

/** Read-only admin receive IDs for offline CPA invoice payment. */
export async function GET() {
  return withAuth(async (session) => {
    try {
      if (!canAdvertiserAccessCpaOffers(session.user.email)) {
        throw Errors.forbidden();
      }
      const settings = await getPlatformSettings();
      return Response.json({ data: adminPayInstructionsFromConfig(settings) });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
