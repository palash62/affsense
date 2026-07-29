import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return withAuth(async (session) => {
    const campaigns = await prisma.campaign.findMany({
      where: { advertiserId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });

    const withEmail = await Promise.all(
      campaigns.map(async (c) => {
        const [automationCount, sendCount, contactCount] = await Promise.all([
          prisma.emailAutomation.count({
            where: { advertiserId: session.user.id, campaignId: c.id },
          }),
          prisma.emailSend.count({
            where: { advertiserId: session.user.id, lead: { campaignId: c.id } },
          }),
          prisma.emailContact.count({
            where: { advertiserId: session.user.id, sourceCampaignId: c.id, status: "SUBSCRIBED" },
          }),
        ]);
        return { ...c, automationCount, sendCount, contactCount };
      }),
    );

    return Response.json({ data: withEmail });
  }, ["ADVERTISER"]);
}
