import { NextResponse } from "next/server";
import {
  getContactByUnsubscribeToken,
  unsubscribeByToken,
} from "@/modules/email-marketing";

type Params = { params: Promise<{ token: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { token } = await params;
  const contact = await unsubscribeByToken(token);
  if (!contact) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Invalid unsubscribe token" } },
      { status: 404 },
    );
  }
  // RFC 8058 One-Click List-Unsubscribe
  return new NextResponse(null, { status: 200 });
}

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  const contact = await getContactByUnsubscribeToken(token);
  if (!contact) {
    return NextResponse.redirect(new URL("/", process.env.NEXTAUTH_URL || "http://localhost:3010"));
  }
  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3010";
  return NextResponse.redirect(new URL(`/unsubscribe/${token}`, appUrl));
}
