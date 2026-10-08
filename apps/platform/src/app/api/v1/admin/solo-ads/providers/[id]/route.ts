import { withRealAdmin } from "@/lib/api-handler";
import { updateSoloProvider } from "@/services/solo-admin.service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withRealAdmin(async (session) => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Parameters<typeof updateSoloProvider>[2];
    const data = await updateSoloProvider(session.user.id, id, body);
    return Response.json({ data });
  });
}
