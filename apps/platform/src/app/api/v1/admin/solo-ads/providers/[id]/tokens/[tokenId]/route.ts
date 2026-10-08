import { withRealAdmin } from "@/lib/api-handler";
import { revokeSoloProviderToken } from "@/services/solo-admin.service";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; tokenId: string }> }) {
  return withRealAdmin(async (session) => {
    const { id, tokenId } = await params;
    const data = await revokeSoloProviderToken(session.user.id, id, tokenId);
    return Response.json({ data: { id: data.id, status: data.status } });
  });
}
