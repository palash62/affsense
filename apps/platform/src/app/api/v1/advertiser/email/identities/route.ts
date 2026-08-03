import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { sendingIdentitySchema } from "@/lib/validations";
import {
  listSendingIdentities,
  refreshDomainVerification,
  requestDomainVerification,
  setDefaultIdentity,
} from "@/modules/email-marketing";

export async function GET() {
  return withAuth(async (session) => {
    const data = await listSendingIdentities(session.user.id);
    return Response.json({ data });
  }, ["ADVERTISER"]);
}

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const parsed = sendingIdentitySchema.safeParse(body);
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
      const data = await requestDomainVerification(
        session.user.id,
        parsed.data.domain,
        parsed.data.fromName,
      );
      return Response.json({ data }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}

export async function PATCH(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const action = body.action as string;
      const identityId = body.identityId as string;

      if (action === "refresh" && identityId) {
        const data = await refreshDomainVerification(session.user.id, identityId);
        return Response.json({ data });
      }
      if (action === "setDefault" && identityId) {
        const data = await setDefaultIdentity(session.user.id, identityId);
        return Response.json({ data });
      }

      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid action", status: 422 } },
        { status: 422 },
      );
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
