import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  return withAuth(async (session) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";

    const searchClause = search
      ? Prisma.sql`AND JSON_UNQUOTE(JSON_EXTRACT(l.data, '$.email')) LIKE ${`%${search}%`}`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<{ email: string }[]>`
      SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(l.data, '$."email"')) AS email
      FROM leads l
      JOIN campaigns c ON l.campaign_id = c.id
      WHERE c.advertiser_id = ${session.user.id}
        AND JSON_UNQUOTE(JSON_EXTRACT(l.data, '$."email"')) IS NOT NULL
        AND JSON_UNQUOTE(JSON_EXTRACT(l.data, '$."email"')) != ''
        ${searchClause}
      ORDER BY email ASC
      LIMIT 50`;

    return Response.json({ data: rows.map((r) => r.email) });
  }, ["ADVERTISER"]);
}
