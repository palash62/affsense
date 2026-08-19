import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const prismaMock = vi.hoisted(() => ({
  emailContact: {
    count: vi.fn(),
  },
  emailList: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  emailListCampaign: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
  campaign: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  createEmailList,
  listEmailLists,
  updateEmailList,
} from "@/modules/email-marketing/services/list.service";

describe("list.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) {
        for (const op of ops) await op;
        return;
      }
      if (typeof ops === "function") {
        return (ops as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
      }
    });
  });

  it("counts subscribers across all list campaigns", async () => {
    prismaMock.emailContact.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(7);

    prismaMock.emailList.findMany.mockResolvedValue([
      {
        id: "list-1",
        name: "Warm leads",
        campaigns: [
          { campaignId: "camp-a", campaign: { id: "camp-a", name: "Campaign A" } },
          { campaignId: "camp-b", campaign: { id: "camp-b", name: "Campaign B" } },
        ],
      },
    ]);

    const rows = await listEmailLists("adv-1");

    expect(prismaMock.emailContact.count).toHaveBeenLastCalledWith({
      where: {
        advertiserId: "adv-1",
        status: "SUBSCRIBED",
        sourceCampaignId: { in: ["camp-a", "camp-b"] },
      },
    });
    expect(rows[1]).toMatchObject({
      id: "list-1",
      campaignIds: ["camp-a", "camp-b"],
      subscribers: 7,
      campaignName: "Campaign A, Campaign B",
    });
  });

  it("creates a list with multiple campaigns", async () => {
    prismaMock.campaign.findMany.mockResolvedValue([
      { id: "camp-a", name: "A" },
      { id: "camp-b", name: "B" },
    ]);
    prismaMock.emailListCampaign.findMany.mockResolvedValue([]);
    prismaMock.emailList.create.mockResolvedValue({ id: "list-new" });

    await createEmailList("adv-1", {
      name: "Combo list",
      campaignIds: ["camp-a", "camp-b"],
    });

    expect(prismaMock.emailList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          advertiserId: "adv-1",
          name: "Combo list",
          campaigns: {
            create: [{ campaignId: "camp-a" }, { campaignId: "camp-b" }],
          },
        }),
      }),
    );
  });

  it("rejects campaigns already linked to another list", async () => {
    prismaMock.campaign.findMany.mockResolvedValue([{ id: "camp-a", name: "A" }]);
    prismaMock.emailListCampaign.findMany.mockResolvedValue([
      {
        campaignId: "camp-a",
        campaign: { name: "A" },
      },
    ]);

    await expect(
      createEmailList("adv-1", { name: "Dup", campaignIds: ["camp-a"] }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("replaces campaigns on update", async () => {
    prismaMock.emailList.findFirst.mockResolvedValue({
      id: "list-1",
      name: "Old",
      campaigns: [{ campaignId: "camp-a", campaign: { id: "camp-a", name: "A" } }],
    });
    prismaMock.campaign.findMany.mockResolvedValue([
      { id: "camp-b", name: "B" },
      { id: "camp-c", name: "C" },
    ]);
    prismaMock.emailListCampaign.findMany.mockResolvedValue([]);
    prismaMock.emailListCampaign.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.emailListCampaign.create.mockResolvedValue({});
    prismaMock.emailList.update.mockResolvedValue({ id: "list-1" });

    await updateEmailList("adv-1", "list-1", {
      campaignIds: ["camp-b", "camp-c"],
    });

    expect(prismaMock.emailListCampaign.deleteMany).toHaveBeenCalledWith({
      where: { listId: "list-1" },
    });
    expect(prismaMock.emailListCampaign.create).toHaveBeenCalledTimes(2);
  });

  it("removes a campaign from a list on update", async () => {
    prismaMock.emailList.findFirst.mockResolvedValue({
      id: "list-1",
      name: "Combo",
      campaigns: [
        { campaignId: "camp-a", campaign: { id: "camp-a", name: "A" } },
        { campaignId: "camp-b", campaign: { id: "camp-b", name: "B" } },
      ],
    });
    prismaMock.campaign.findMany.mockResolvedValue([{ id: "camp-b", name: "B" }]);
    prismaMock.emailListCampaign.findMany.mockResolvedValue([]);
    prismaMock.emailListCampaign.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.emailListCampaign.create.mockResolvedValue({});
    prismaMock.emailList.update.mockResolvedValue({ id: "list-1" });

    await updateEmailList("adv-1", "list-1", {
      campaignIds: ["camp-b"],
    });

    expect(prismaMock.emailListCampaign.deleteMany).toHaveBeenCalledWith({
      where: { listId: "list-1" },
    });
    expect(prismaMock.emailListCampaign.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.emailListCampaign.create).toHaveBeenCalledWith({
      data: { listId: "list-1", campaignId: "camp-b" },
    });
  });
});
