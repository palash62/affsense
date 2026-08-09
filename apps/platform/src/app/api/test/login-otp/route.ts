import { prisma } from "@/lib/prisma";
import { createLoginOtp } from "@/services/auth-token.service";

export async function POST(request: Request) {
  if (process.env.ALLOW_TEST_ROUTES !== "1") {
    return new Response("Not found", { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return Response.json({ error: "email required" }, { status: 422 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, status: true },
  });

  if (
    !user ||
    user.status !== "ACTIVE" ||
    (user.role !== "ADMIN" &&
      user.role !== "PLATFORM_MANAGER" &&
      user.role !== "ADVERTISER" &&
      user.role !== "PUBLISHER")
  ) {
    return Response.json({ error: "user not found" }, { status: 404 });
  }

  const { code } = await createLoginOtp(user.id);
  return Response.json({ code });
}
