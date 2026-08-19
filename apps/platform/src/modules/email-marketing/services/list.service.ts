import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export type EmailListRow = {
  id: string;
  name: string;
  campaignIds: string[];
  campaigns: { id: string; name: string }[];
  /** @deprecated Use campaigns — first campaign for backward compat */
  campaignId: string | null;
  /** @deprecated Use campaigns — comma-joined names for backward compat */
  campaignName: string | null;
  subscribers: number;
  system?: boolean;
};

const listCampaignInclude = {
  campaigns: {
    include: { campaign: { select: { id: true, name: true } } },
    orderBy: { campaign: { name: "asc" as const } },
  },
} as const;

function mapListCampaigns(
  rows: Array<{ campaign: { id: string; name: string } }>,
) {
  return rows.map((r) => ({ id: r.campaign.id, name: r.campaign.name }));
}

function rowFromList(
  list: {
    id: string;
    name: string;
    campaigns: Array<{ campaign: { id: string; name: string } }>;
  },
  subscribers: number,
): EmailListRow {
  const campaigns = mapListCampaigns(list.campaigns);
  const campaignIds = campaigns.map((c) => c.id);
  return {
    id: list.id,
    name: list.name,
    campaignIds,
    campaigns,
    campaignId: campaignIds[0] ?? null,
    campaignName: campaigns.map((c) => c.name).join(", ") || null,
    subscribers,
  };
}

async function assertCampaignsOwned(advertiserId: string, campaignIds: string[]) {
  const unique = [...new Set(campaignIds)];
  if (!unique.length) {
    throw new AppError("VALIDATION_ERROR", "Select at least one campaign", 422);
  }

  const owned = await prisma.campaign.findMany({
    where: { advertiserId, id: { in: unique } },
    select: { id: true, name: true },
  });
  if (owned.length !== unique.length) {
    throw new AppError("VALIDATION_ERROR", "One or more campaigns were not found", 422);
  }
  return owned;
}

async function assertCampaignsAvailable(
  advertiserId: string,
  campaignIds: string[],
  excludeListId?: string,
) {
  const clashes = await prisma.emailListCampaign.findMany({
    where: {
      campaignId: { in: campaignIds },
      list: { advertiserId },
      ...(excludeListId ? { listId: { not: excludeListId } } : {}),
    },
    include: { campaign: { select: { name: true } } },
  });
  if (clashes.length) {
    const names = clashes.map((c) => c.campaign.name).join(", ");
    throw new AppError(
      "VALIDATION_ERROR",
      `A list already exists for: ${names}`,
      422,
    );
  }
}

export async function listEmailLists(advertiserId: string): Promise<EmailListRow[]> {
  const [totalSubscribers, lists] = await Promise.all([
    prisma.emailContact.count({
      where: { advertiserId, status: "SUBSCRIBED" },
    }),
    prisma.emailList.findMany({
      where: { advertiserId },
      orderBy: { name: "asc" },
      include: listCampaignInclude,
    }),
  ]);

  const withCounts = await Promise.all(
    lists.map(async (list) => {
      const campaignIds = list.campaigns.map((c) => c.campaignId);
      const subscribers = campaignIds.length
        ? await prisma.emailContact.count({
            where: {
              advertiserId,
              status: "SUBSCRIBED",
              sourceCampaignId: { in: campaignIds },
            },
          })
        : 0;
      return rowFromList(list, subscribers);
    }),
  );

  return [
    {
      id: "all",
      name: "All Subscribers",
      campaignIds: [],
      campaigns: [],
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
  data: { name: string; campaignIds: string[] },
) {
  const campaignIds = [...new Set(data.campaignIds)];
  await assertCampaignsOwned(advertiserId, campaignIds);
  await assertCampaignsAvailable(advertiserId, campaignIds);

  return prisma.emailList.create({
    data: {
      advertiserId,
      name: data.name.trim(),
      campaigns: {
        create: campaignIds.map((campaignId) => ({ campaignId })),
      },
    },
    include: listCampaignInclude,
  });
}

export async function updateEmailList(
  advertiserId: string,
  id: string,
  data: { name?: string; campaignIds?: string[] },
) {
  const list = await prisma.emailList.findFirst({
    where: { id, advertiserId },
    include: listCampaignInclude,
  });
  if (!list) throw new AppError("NOT_FOUND", "List not found", 404);

  if (data.campaignIds) {
    const campaignIds = [...new Set(data.campaignIds)];
    await assertCampaignsOwned(advertiserId, campaignIds);
    await assertCampaignsAvailable(advertiserId, campaignIds, id);

    await prisma.$transaction([
      prisma.emailListCampaign.deleteMany({ where: { listId: id } }),
      ...campaignIds.map((campaignId) =>
        prisma.emailListCampaign.create({
          data: { listId: id, campaignId },
        }),
      ),
    ]);
  }

  return prisma.emailList.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
    },
    include: listCampaignInclude,
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

/** Resolve campaign IDs for a list (empty if not found). */
export async function getListCampaignIds(
  advertiserId: string,
  listId: string,
): Promise<string[]> {
  const list = await prisma.emailList.findFirst({
    where: { id: listId, advertiserId },
    select: { campaigns: { select: { campaignId: true } } },
  });
  return list?.campaigns.map((c) => c.campaignId) ?? [];
}
