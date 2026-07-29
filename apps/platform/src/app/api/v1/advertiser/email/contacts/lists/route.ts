import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return withAuth(async (session) => {
    const totalSubscribers = await prisma.emailContact.count({
      where: { advertiserId: session.user.id, status: "SUBSCRIBED" },
    });

    const byCampaign = await prisma.emailContact.groupBy({
      by: ["sourceCampaignId"],
      where: {
        advertiserId: session.user.id,
        status: "SUBSCRIBED",
        sourceCampaignId: { not: null },
      },
      _count: { id: true },
    });

    const campaignIds = byCampaign
      .map((g) => g.sourceCampaignId)
      .filter((id): id is string => id !== null);

    const campaigns =
      campaignIds.length > 0
        ? await prisma.campaign.findMany({
            where: { id: { in: campaignIds } },
            select: { id: true, name: true },
          })
        : [];

    const campaignMap = new Map(campaigns.map((c) => [c.id, c.name]));

    const lists = [
      { id: "all", name: "All Subscribers", subscribers: totalSubscribers },
      ...byCampaign.map((g) => ({
        id: g.sourceCampaignId!,
        name: campaignMap.get(g.sourceCampaignId!) ?? "Unknown Campaign",
        subscribers: g._count.id,
      })),
    ];

    return Response.json({ data: lists });
  }, ["ADVERTISER"]);
}
