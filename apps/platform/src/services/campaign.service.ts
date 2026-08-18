import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createPixelToken } from "@/lib/campaign-pixel.server";
import type { CampaignCategory, CampaignStatus, PublisherAccess } from "@prisma/client";
import { notifyAdminAlert, notifyApproved, notifyGeneric } from "@/services/notify.service";
import { Errors } from "@/lib/errors";
import {
  canAdminDeleteCampaign,
  canAdvertiserTransitionStatus,
  canTransitionStatus,
} from "@/lib/campaign-lifecycle";
import {
  linkOptinPageToCampaign,
  resolveOptinPageDestination,
} from "@/services/optin-page.service";
import { parseCampaignTargeting } from "@/lib/campaign-targeting";
import { ADVERTISER_EXCLUDED_LEAD_STATUSES } from "@/services/lead.service";

export interface CreateCampaignInput {
  advertiserId: string;
  name: string;
  description?: string;
  category: CampaignCategory;
  cpl: number;
  budget?: number | null;
  dailyCap?: number | null;
  monthlyCap?: number | null;
  publisherAccess?: PublisherAccess;
  autoApprove?: boolean;
  status?: CampaignStatus;
  targeting?: Record<string, unknown>;
  fields?: Array<{
    fieldName: string;
    label: string;
    fieldType: string;
    required?: boolean;
    validationRules?: Record<string, unknown>;
    sortOrder?: number;
  }>;
}

/** Positive budget, or null for unlimited. Rejects 0/negative. */
export function assertValidCampaignBudget(budget: number | null) {
  if (budget === null) return null;
  if (!Number.isFinite(budget) || budget <= 0) {
    throw Errors.validation("Total budget must be a positive amount or left blank for unlimited", "budget");
  }
  return budget;
}

export async function createCampaign(input: CreateCampaignInput) {
  const budget = assertValidCampaignBudget(input.budget ?? null);

  return prisma.campaign.create({
    data: {
      advertiserId: input.advertiserId,
      name: input.name,
      description: input.description,
      category: input.category,
      cpl: input.cpl,
      budget,
      dailyCap: input.dailyCap,
      monthlyCap: input.monthlyCap,
      publisherAccess: "OPEN",
      autoApprove: true,
      status: input.status ?? "DRAFT",
      targeting: (input.targeting ?? {}) as Prisma.InputJsonValue,
      pixelToken: createPixelToken(),
      fields: input.fields
        ? {
            create: input.fields.map((f, i) => ({
              fieldName: f.fieldName,
              label: f.label,
              fieldType: f.fieldType,
              required: f.required ?? true,
              validationRules: f.validationRules as Prisma.InputJsonValue | undefined,
              sortOrder: f.sortOrder ?? i,
            })),
          }
        : undefined,
    },
    include: { fields: true },
  });
}

export async function listCampaigns(filters: {
  advertiserId?: string;
  publisherId?: string;
  status?: CampaignStatus;
  page?: number;
  limit?: number;
  includeAdvertiserEmail?: boolean;
}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const where: Prisma.CampaignWhereInput = {
    ...(filters.advertiserId && { advertiserId: filters.advertiserId }),
    ...(filters.status && { status: filters.status }),
    ...(filters.publisherId && {
      OR: [
        { publisherAccess: "OPEN" },
        { publisherCampaigns: { some: { publisherId: filters.publisherId } } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      include: {
        fields: true,
        advertiser: {
          select: {
            name: true,
            ...(filters.includeAdvertiserEmail ? { email: true } : {}),
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.campaign.count({ where }),
  ]);

  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export type AdvertiserCampaignSort =
  | "created_desc"
  | "name_asc"
  | "name_desc"
  | "leads_asc"
  | "leads_desc"
  | "cpl_asc"
  | "cpl_desc"
  | "spent_asc"
  | "spent_desc";

export async function listAdvertiserCampaigns(filters: {
  advertiserId: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sort?: AdvertiserCampaignSort;
  page?: number;
  limit?: number;
}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 10;

  const where: Prisma.CampaignWhereInput = {
    advertiserId: filters.advertiserId,
  };

  if (filters.search?.trim()) {
    where.name = { contains: filters.search.trim() };
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      from.setHours(0, 0, 0, 0);
      where.createdAt.gte = from;
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }

  const sort = filters.sort ?? "created_desc";
  const orderBy: Prisma.CampaignOrderByWithRelationInput =
    sort === "name_asc"
      ? { name: "asc" }
      : sort === "name_desc"
        ? { name: "desc" }
        : sort === "leads_asc"
          ? { leads: { _count: "asc" } }
          : sort === "leads_desc"
            ? { leads: { _count: "desc" } }
            : sort === "cpl_asc"
              ? { cpl: "asc" }
              : sort === "cpl_desc"
                ? { cpl: "desc" }
                : sort === "spent_asc"
                  ? { spent: "asc" }
                  : sort === "spent_desc"
                    ? { spent: "desc" }
                    : { createdAt: "desc" };

  const [raw, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      include: {
        _count: {
          select: {
            leads: { where: { status: { notIn: [...ADVERTISER_EXCLUDED_LEAD_STATUSES] } } },
          },
        },
        optinPages: {
          select: { slug: true },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.campaign.count({ where }),
  ]);

  const data = raw;

  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function ensureCampaignPixelToken(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, pixelToken: true },
  });

  if (!campaign) return null;
  if (campaign.pixelToken) return campaign.pixelToken;

  const pixelToken = createPixelToken();
  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { pixelToken },
    select: { pixelToken: true },
  });

  return updated.pixelToken;
}

export async function getCampaignById(id: string) {
  return prisma.campaign.findUnique({
    where: { id },
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
      advertiser: { select: { id: true, name: true, email: true } },
      publisherCampaigns: {
        include: { publisher: { select: { id: true, name: true, email: true } } },
      },
      optinPages: {
        select: { slug: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      _count: { select: { leads: true } },
    },
  });
}

async function resolveCampaignTestFunnel(campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId },
    select: {
      id: true,
      advertiserId: true,
      targeting: true,
      optinPages: {
        select: { id: true, slug: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!campaign) throw Errors.notFound("Campaign");

  const linkedPage = campaign.optinPages[0];
  if (linkedPage) {
    return { campaign, funnel: linkedPage };
  }

  const { optinPageId } = parseCampaignTargeting(campaign.targeting);
  if (optinPageId) {
    const targetedPage = await prisma.advertiserOptinPage.findFirst({
      where: { id: optinPageId, advertiserId: campaign.advertiserId },
      select: { id: true, slug: true },
    });
    if (targetedPage) {
      return { campaign, funnel: targetedPage };
    }
  }

  throw Errors.validation("Attach a funnel to this campaign before testing");
}

/** Any role that can open the campaign funnel in test mode (e.g. admin). */
export async function getCampaignTestFunnel(campaignId: string) {
  const { funnel } = await resolveCampaignTestFunnel(campaignId);
  return funnel;
}

export async function getAdvertiserCampaignTestFunnel(
  campaignId: string,
  advertiserId: string,
) {
  const { campaign, funnel } = await resolveCampaignTestFunnel(campaignId);
  if (campaign.advertiserId !== advertiserId) {
    throw Errors.notFound("Campaign");
  }
  return funnel;
}

export async function updateCampaignStatus(id: string, status: CampaignStatus) {
  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      status,
      ...(status === "PAUSED"
        ? { pausedReason: "Paused by admin" }
        : status === "ACTIVE"
          ? { pausedReason: null }
          : {}),
    },
    include: { advertiser: { select: { id: true, email: true, name: true } } },
  });

  void notifyGeneric(campaign.advertiser, {
    title: "Campaign status updated",
    message: `Your campaign "${campaign.name}" is now ${status.replace(/_/g, " ").toLowerCase()}.`,
    actionPath: "/advertiser/campaigns",
    notificationType: "campaign.status_changed",
  });

  return campaign;
}

export async function updateCampaignByAdmin(
  id: string,
  body: Record<string, unknown>,
  adminId: string,
  options?: { baseUrl?: string; actorRole?: "ADMIN" | "ADVERTISER" },
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { _count: { select: { leads: true } } },
  });

  if (!campaign) {
    throw Errors.notFound("Campaign");
  }

  const lifecycle = { status: campaign.status, leadCount: campaign._count.leads };

  const data: Prisma.CampaignUpdateInput = {
    publisherAccess: "OPEN",
    autoApprove: true,
  };
  const scalarFields = [
    "name",
    "description",
    "cpl",
    "budget",
    "dailyCap",
    "monthlyCap",
    "category",
  ] as const;

  for (const field of scalarFields) {
    if (body[field] !== undefined) {
      (data as Record<string, unknown>)[field] = body[field];
    }
  }

  if (body.budget !== undefined) {
    (data as Record<string, unknown>).budget = assertValidCampaignBudget(
      body.budget === null ? null : Number(body.budget),
    );
  }

  if (body.targeting !== undefined) {
    data.targeting = body.targeting as Prisma.InputJsonValue;
  }

  if (body.optinPageId !== undefined && typeof body.optinPageId === "string") {
    if (!options?.baseUrl) {
      options = { baseUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000" };
    }

    const { page, destinationUrl } = await resolveOptinPageDestination(
      body.optinPageId,
      campaign.advertiserId,
      options.baseUrl!,
    );

    const currentTargeting =
      body.targeting !== undefined
        ? (body.targeting as Record<string, unknown>)
        : campaign.targeting && typeof campaign.targeting === "object"
          ? (campaign.targeting as Record<string, unknown>)
          : {};

    data.targeting = {
      ...currentTargeting,
      destinationUrl,
      optinPageId: page.id,
      optinSlug: page.slug,
    } as Prisma.InputJsonValue;

    data.description = `Optin page: ${page.title}`;

    await linkOptinPageToCampaign(page.id, id, campaign.advertiserId);
  }

  if (body.fields !== undefined) {
    const fields = body.fields as Array<{
      fieldName: string;
      label: string;
      fieldType: string;
      required?: boolean;
      validationRules?: Record<string, unknown>;
      sortOrder?: number;
    }>;

    await prisma.campaignField.deleteMany({ where: { campaignId: id } });
    if (fields.length > 0) {
      await prisma.campaignField.createMany({
        data: fields.map((field, index) => ({
          campaignId: id,
          fieldName: field.fieldName,
          label: field.label,
          fieldType: field.fieldType,
          required: field.required ?? true,
          validationRules: (field.validationRules ?? undefined) as Prisma.InputJsonValue | undefined,
          sortOrder: field.sortOrder ?? index,
        })),
      });
    }
  }

  if (body.status !== undefined) {
    const nextStatus = body.status as CampaignStatus;
    const actorRole = options?.actorRole ?? "ADMIN";
    const allowed =
      actorRole === "ADVERTISER"
        ? canAdvertiserTransitionStatus(campaign.status, nextStatus)
        : canTransitionStatus(campaign.status, nextStatus);
    if (!allowed) {
      throw Errors.campaignInvalidTransition(
        `Cannot change status from ${campaign.status} to ${nextStatus}`,
      );
    }
    data.status = nextStatus;
    if (nextStatus === "PAUSED") {
      data.pausedReason = actorRole === "ADVERTISER" ? "Paused by you" : "Paused by admin";
    } else if (nextStatus === "ACTIVE") {
      data.pausedReason = null;
    }
  }

  const updated = await prisma.campaign.update({
    where: { id },
    data,
    include: { advertiser: { select: { id: true, email: true, name: true } } },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "campaign.updated",
      entityType: "campaign",
      entityId: id,
      metadata: {
        status: updated.status,
        limitedEdit: false,
      },
    },
  });

  if (body.status && body.status !== campaign.status) {
    void notifyGeneric(updated.advertiser, {
      title: "Campaign status updated",
      message: `Your campaign "${updated.name}" is now ${String(body.status).replace(/_/g, " ").toLowerCase()}.`,
      actionPath: "/advertiser/campaigns",
      notificationType: "campaign.status_changed",
    });

    if (
      campaign.status === "DRAFT" &&
      body.status === "PENDING" &&
      options?.actorRole === "ADVERTISER"
    ) {
      void notifyAdminAlert({
        title: "Campaign pending review",
        message: `${updated.advertiser.name} submitted "${updated.name}" for approval.`,
        actionPath: "/admin/campaigns",
        metadata: { campaignId: id, advertiserId: updated.advertiser.id },
      });
    }
  }

  return updated;
}

export async function deleteCampaignByAdmin(id: string, adminId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { _count: { select: { leads: true } } },
  });

  if (!campaign) {
    throw Errors.notFound("Campaign");
  }

  const lifecycle = { status: campaign.status, leadCount: campaign._count.leads };

  if (!canAdminDeleteCampaign(lifecycle)) {
    if (campaign._count.leads > 0) {
      throw Errors.campaignHasLeads();
    }
    if (campaign.status === "ACTIVE" || campaign.status === "PAUSED") {
      throw Errors.campaignIsActive();
    }
    throw Errors.campaignReadOnly();
  }

  await prisma.campaign.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "campaign.deleted",
      entityType: "campaign",
      entityId: id,
      metadata: { name: campaign.name },
    },
  });
}

export async function joinCampaign(publisherId: string, campaignId: string) {
  const [campaign, publisher] = await Promise.all([
    prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { id: true, name: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: publisherId },
      select: { id: true, email: true, name: true },
    }),
  ]);

  const join = await prisma.publisherCampaign.upsert({
    where: {
      publisherId_campaignId: { publisherId, campaignId },
    },
    create: {
      publisherId,
      campaignId,
      status: "APPROVED",
      approvedAt: new Date(),
    },
    update: {},
  });

  void notifyApproved(
    publisher,
    "Campaign access",
    `You can now promote "${campaign.name}".`,
    "campaign.join_approved",
  );

  return join;
}

export async function createTrackingLink(publisherId: string, campaignId: string) {
  const slug = `${publisherId.slice(-6)}-${campaignId.slice(-6)}-${Date.now().toString(36)}`;

  return prisma.trackingLink.create({
    data: { publisherId, campaignId, slug },
  });
}

export async function getMarketplaceCampaigns(publisherId: string) {
  return prisma.campaign.findMany({
    where: { status: "ACTIVE" },
    include: {
      fields: true,
      publisherCampaigns: {
        where: { publisherId },
      },
    },
    orderBy: { cpl: "desc" },
  });
}

export type PublisherCampaignSort =
  | "approved_desc"
  | "name_asc"
  | "name_desc"
  | "cpl_asc"
  | "cpl_desc"
  | "clicks_asc"
  | "clicks_desc"
  | "status_asc"
  | "status_desc";

export async function listPublisherCampaigns(filters: {
  publisherId: string;
  search?: string;
  status?: string;
  sort?: PublisherCampaignSort;
  page?: number;
  limit?: number;
}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 10;

  const where: Prisma.PublisherCampaignWhereInput = {
    publisherId: filters.publisherId,
  };

  if (filters.status && filters.status !== "all") {
    where.status = filters.status as never;
  }

  if (filters.search?.trim()) {
    where.campaign = { name: { contains: filters.search.trim() } };
  }

  const sort = filters.sort ?? "approved_desc";
  const orderBy: Prisma.PublisherCampaignOrderByWithRelationInput =
    sort === "name_asc"
      ? { campaign: { name: "asc" } }
      : sort === "name_desc"
        ? { campaign: { name: "desc" } }
        : sort === "cpl_asc"
          ? { campaign: { cpl: "asc" } }
          : sort === "cpl_desc"
            ? { campaign: { cpl: "desc" } }
            : sort === "status_asc"
              ? { status: "asc" }
              : sort === "status_desc"
                ? { status: "desc" }
                : { approvedAt: "desc" };

  const [raw, total] = await Promise.all([
    prisma.publisherCampaign.findMany({
      where,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            cpl: true,
            status: true,
            category: true,
            trackingLinks: {
              where: { publisherId: filters.publisherId },
              select: { slug: true, clickCount: true },
            },
          },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.publisherCampaign.count({ where }),
  ]);

  const data = raw
    .map((join) => ({
      ...join,
      clickCount: join.campaign.trackingLinks.reduce((sum, link) => sum + link.clickCount, 0),
      trackingSlug: join.campaign.trackingLinks[0]?.slug ?? null,
    }))
    .sort((a, b) => {
      if (sort === "clicks_asc") return a.clickCount - b.clickCount;
      if (sort === "clicks_desc") return b.clickCount - a.clickCount;
      return 0;
    });

  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}
