import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { getWalletBalance } from "@/services/wallet.service";
import { createCardPaymentIntent } from "@/services/stripe-payment.service";

export async function GET() {
  return withAuth(async (session) => {
    const balance = await getWalletBalance(session.user.id);
    return Response.json(balance ?? { balance: 0, holdBalance: 0, availableBalance: 0, currency: "USD" });
  });
}

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const amount = Number(body.amount);

      if (!amount || amount <= 0) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Amount must be greater than zero", status: 422 } },
          { status: 422 },
        );
      }

      if (amount < 10) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Minimum deposit is $10.00", status: 422 } },
          { status: 422 },
        );
      }

      const deposit = await createCardPaymentIntent(session.user.id, amount);
      return Response.json(deposit, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED") {
        return Response.json(
          {
            error: {
              code: "STRIPE_NOT_CONFIGURED",
              message: "Credit card payments are not available yet. Contact support.",
              status: 422,
            },
          },
          { status: 422 },
        );
      }
      return errorResponse(error);
    }
  }, ["ADVERTISER", "ADMIN"]);
}
