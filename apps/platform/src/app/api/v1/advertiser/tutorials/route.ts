import { withAuth } from "@/lib/api-handler";

export async function GET() {
  return withAuth(async () => Response.json({ data: [] }), ["ADVERTISER"]);
}
