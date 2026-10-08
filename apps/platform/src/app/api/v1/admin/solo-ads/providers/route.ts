import { withAuth, withRealAdmin } from "@/lib/api-handler";
import { ADMIN_PORTAL_ROLES } from "@/lib/admin-portal";
import { assertSoloAdminAccess } from "@/lib/solo-ads-access";
import { createSoloProvider, listSoloProviders } from "@/services/solo-admin.service";

export async function GET() {
  return withAuth(async (session) => {
    assertSoloAdminAccess(session);
    return Response.json({ data: await listSoloProviders() });
  }, ADMIN_PORTAL_ROLES);
}

export async function POST(request: Request) {
  return withRealAdmin(async (session) => {
    const body = (await request.json().catch(() => ({}))) as Parameters<typeof createSoloProvider>[1];
    const data = await createSoloProvider(session.user.id, body);
    return Response.json({ data }, { status: 201 });
  });
}
