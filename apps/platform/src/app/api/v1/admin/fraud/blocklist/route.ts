import { withAuth, parsePagination, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { addBlocklistIp, listBlocklistIps, removeBlocklistIp } from "@/modules/fraud";

export async function GET(request: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const data = await listBlocklistIps(page, limit);
    return Response.json(data);
  }, ADMIN_PORTAL_ROLES);
}

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const body = await request.json();
      const ip = typeof body.ip === "string" ? body.ip.trim() : "";
      if (!ip) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "IP address is required", status: 422 } },
          { status: 422 },
        );
      }
      const row = await addBlocklistIp(ip, typeof body.reason === "string" ? body.reason : undefined);
      return Response.json({ data: row }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}

export async function DELETE(request: Request) {
  return withAuth(async () => {
    try {
      const body = await request.json();
      const ip = typeof body.ip === "string" ? body.ip.trim() : "";
      if (!ip) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "IP address is required", status: 422 } },
          { status: 422 },
        );
      }
      await removeBlocklistIp(ip);
      return Response.json({ ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
