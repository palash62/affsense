import { withRealAdmin } from "@/lib/api-handler";
import { Errors } from "@/lib/errors";
import { issueSoloProviderToken } from "@/services/solo-admin.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withRealAdmin(async (session) => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { trafficType?: unknown };
    if (body.trafficType !== "REGULAR" && body.trafficType !== "WARM") {
      throw Errors.validation("Choose regular or warm traffic", "trafficType");
    }
    const data = await issueSoloProviderToken(session.user.id, id, body.trafficType);
    return Response.json({ data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}
