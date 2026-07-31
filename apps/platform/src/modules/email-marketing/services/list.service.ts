import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export type EmailListRow = {
  id: string;
  name: string;
  campaignId: string | null;
  campaignName: string | null;
  subscribers: number;
  system?: boolean;
};

async function assertCampaignOwned(advertiserId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, advertiserId },
    select: { id: true, name: true },
  });
  if (!campaign) {
    throw new AppError("VALIDATION_ERROR", "Campaign not found", 422);
  }
  return campaign;
}

export async function listEmailLists(advertiserId: string): Promise<EmailListRow[]> {
  const [totalSubscribers, lists] = await Promise.all([
    prisma.emailContact.count({
      where: { advertiserId, status: "SUBSCRIBED" },
    }),
    prisma.emailList.findMany({
      where: { advertiserId },
      orderBy: { name: "asc" },
      include: { campaign: { select: { id: true, name: true } } },
    }),
  ]);

  const withCounts = await Promise.all(
    lists.map(async (list) => {
      const subscribers = await prisma.emailContact.count({
        where: {
          advertiserId,
          status: "SUBSCRIBED",
          sourceCampaignId: list.campaignId,
        },
      });
      return {
        id: list.id,
        name: list.name,
        campaignId: list.campaignId,
        campaignName: list.campaign.name,
        subscribers,
      };
    }),
  );

  return [
    {
      id: "all",
      name: "All Subscribers",
      campaignId: null,
      campaignName: null,
      subscribers: totalSubscribers,
      system: true,
    },
    ...withCounts,
  ];
}

export async function createEmailList(
  advertiserId: string,
  data: { name: string; campaignId: string },
) {
  await assertCampaignOwned(advertiserId, data.campaignId);

  const existing = await prisma.emailList.findUnique({
    where: {
      advertiserId_campaignId: {
        advertiserId,
        campaignId: data.campaignId,
      },
    },
  });
  if (existing) {
    throw new AppError(
      "VALIDATION_ERROR",
      "A list already exists for this campaign",
      422,
    );
  }

  return prisma.emailList.create({
    data: {
      advertiserId,
      name: data.name.trim(),
      campaignId: data.campaignId,
    },
    include: { campaign: { select: { id: true, name: true } } },
  });
}

export async function updateEmailList(
  advertiserId: string,
  id: string,
  data: { name?: string; campaignId?: string },
) {
  const list = await prisma.emailList.findFirst({
    where: { id, advertiserId },
  });
  if (!list) throw new AppError("NOT_FOUND", "List not found", 404);

  const nextCampaignId = data.campaignId ?? list.campaignId;
  if (data.campaignId && data.campaignId !== list.campaignId) {
    await assertCampaignOwned(advertiserId, data.campaignId);
    const clash = await prisma.emailList.findUnique({
      where: {
        advertiserId_campaignId: {
          advertiserId,
          campaignId: data.campaignId,
        },
      },
    });
    if (clash && clash.id !== id) {
      throw new AppError(
        "VALIDATION_ERROR",
        "A list already exists for this campaign",
        422,
      );
    }
  }

  return prisma.emailList.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.campaignId !== undefined ? { campaignId: nextCampaignId } : {}),
    },
    include: { campaign: { select: { id: true, name: true } } },
  });
}

export async function deleteEmailList(advertiserId: string, id: string) {
  const list = await prisma.emailList.findFirst({
    where: { id, advertiserId },
  });
  if (!list) throw new AppError("NOT_FOUND", "List not found", 404);
  await prisma.emailList.delete({ where: { id } });
  return { id };
}
