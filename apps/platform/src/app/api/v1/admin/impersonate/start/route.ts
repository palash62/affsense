import { NextResponse } from "next/server";
import { consumeImpersonationToken } from "@/services/impersonation.service";
import {
  VIEW_AS_COOKIE,
  createViewAsCookieValue,
  viewAsCookieOptions,
} from "@/lib/view-as";
import { assertSafeRelativeRedirect } from "@/lib/safe-url";

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const redirectPath = assertSafeRelativeRedirect(searchParams.get("redirectTo"), "/admin");

  if (!token) {
    return redirectTo(request, "/admin?error=impersonation_failed");
  }

  const result = await consumeImpersonationToken(token);
  if (!result || result.purpose !== "IMPERSONATE" || !result.impersonatorId) {
    return redirectTo(request, "/admin?error=impersonation_failed");
  }

  const response = redirectTo(request, redirectPath);
  response.cookies.set(
    VIEW_AS_COOKIE,
    await createViewAsCookieValue(result.user, result.impersonatorId),
    viewAsCookieOptions(),
  );
  return response;
}
