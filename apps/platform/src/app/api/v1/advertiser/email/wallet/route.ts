import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { emailWalletTopUpSchema } from "@/lib/validations";
import {
  getEmailWalletSnapshot,
  topUpFromMainWallet,
} from "@/modules/email-marketing/services/email-wallet.service";

export async function GET() {
  return withAuth(async (session) => {
    const data = await getEmailWalletSnapshot(session.user.id);
    return Response.json({ data });
  }, ["ADVERTISER"]);
}

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const parsed = emailWalletTopUpSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: parsed.error.issues[0]?.message ?? "Invalid amount",
              status: 422,
            },
          },
          { status: 422 },
        );
      }

      const data = await topUpFromMainWallet(session.user.id, parsed.data.amount);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
