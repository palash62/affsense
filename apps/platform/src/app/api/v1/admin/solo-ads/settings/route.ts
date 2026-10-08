import { loadSoloAdsConfig, type SoloAdsConfig } from "@cpl/tracking-core";
import { withAuth, withRealAdmin } from "@/lib/api-handler";
import { ADMIN_PORTAL_ROLES } from "@/lib/admin-portal";
import { assertSoloAdminAccess } from "@/lib/solo-ads-access";
import { updateSoloAdsSettings } from "@/services/solo-admin.service";

export async function GET() {
  return withAuth(async (session) => {
    assertSoloAdminAccess(session);
    return Response.json({ data: await loadSoloAdsConfig() });
  }, ADMIN_PORTAL_ROLES);
}

export async function PUT(request: Request) {
  return withRealAdmin(async (session) => {
    const body = (await request.json().catch(() => ({}))) as Partial<SoloAdsConfig>;
    const data = await updateSoloAdsSettings(session.user.id, body);
    return Response.json({ data });
  });
}
