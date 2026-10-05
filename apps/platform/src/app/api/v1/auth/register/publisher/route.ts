import { publisherRegisterSchema } from "@/lib/validations";
import { errorResponse } from "@/lib/errors";
import { registerPublisherAccount } from "@/services/auth.service";
import { runSignupGuard } from "@/lib/signup-guard";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const guard = await runSignupGuard(request, body);
    if (!guard.ok) return guard.response;

    const parsed = publisherRegisterSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? parsed.error.message;
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message, status: 422 } },
        { status: 422 },
      );
    }

    const { user, emailDelivery } = await registerPublisherAccount(parsed.data);

    return Response.json(
      {
        user: { id: user.id, email: user.email, role: user.role, status: user.status },
        message:
          "Check your email to verify your address. After verification, an admin will review your publisher application.",
        emailDelivery,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
