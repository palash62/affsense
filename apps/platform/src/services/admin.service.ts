import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import type { CampaignStatus, UserRole, UserStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  serializePublisherSpecialTierPayouts,
} from "@/lib/publisher-special-payout";
import { validateEmailDeliverability } from "@/lib/email-deliverability";
import { createEmailVerificationToken } from "@/services/auth-token.service";
import {
  parsePlatformSettings,
  platformSettingsToUpdates,
  settingsConfigToApi,
} from "@/lib/platform-settings";
import { PENDING_PAYOUT_STATUSES } from "@/lib/payout-status";
import {
  notifyAccountActivated,
  notifyAccountSuspended,
  notifyAdminAlert,
  notifyApproved,
  notifyCampaignApproved,
  notifyCampaignRejected,
  notifyEmailVerification,
  notifyAdvertiserCredentials,
  notifyPublisherCredentials,
  notifyPlatformManagerCredentials,
  notifyRejected,
  notifyUserById,
} from "@/services/notify.service";
import { parseStaffMenuAccess } from "@/lib/admin-portal";

export async function listUsers(filters: {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;

  const where: Prisma.UserWhereInput = {
    ...(filters.role && { role: filters.role }),
    ...(filters.status && { status: filters.status }),
  };

  if (filters.search?.trim()) {
    const term = filters.search.trim();
    where.OR = [
      { name: { contains: term } },
      { email: { contains: term } },
      ...(filters.role === "ADVERTISER"
        ? [{ advertiserProfile: { company: { contains: term } } }]
        : []),
    ];
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

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        emailVerified: true,
        phone: true,
        country: true,
        staffMenuAccess: true,
        createdAt: true,
        signupUtmSource: true,
        signupUtmMedium: true,
        signupUtmCampaign: true,
        signupUtmContent: true,
        signupUtmTerm: true,
        advertiserProfile: { select: { company: true } },
        publisherProfile: {
          select: {
            kycStatus: true,
            website: true,
            trafficSource: true,
            country: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            postalCode: true,
            rejectionReason: true,
            rejectedAt: true,
            qualityScore: true,
            spamScore: true,
            fraudFlags: true,
            useSpecialTierPayouts: true,
            tier1SpecialPayout: true,
            tier2SpecialPayout: true,
            tier3SpecialPayout: true,
            restrictSmartLinkCampaigns: true,
          },
        },
        smartLinkCampaigns: { select: { campaignId: true } },
        wallet: { select: { balance: true, holdBalance: true } },
        _count: { select: { campaigns: true, leads: true, deposits: true, payouts: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  const serialized = data.map((user) => ({
    ...user,
    wallet: user.wallet
      ? {
          balance: Number(user.wallet.balance),
          holdBalance: Number(user.wallet.holdBalance),
        }
      : null,
    publisherProfile: user.publisherProfile
      ? {
          ...user.publisherProfile,
          ...serializePublisherSpecialTierPayouts(user.publisherProfile),
        }
      : user.publisherProfile,
    allowedSmartLinkCampaignIds: (user.smartLinkCampaigns?.map((r) => r.campaignId) ?? []) as string[],
    _count: user._count,
    advertiserProfile: user.advertiserProfile,
  }));

  return { data: serialized, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getAdvertiserDetail(id: string) {
  const user = await prisma.user.findUnique({
    where: { id, role: "ADVERTISER" },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      emailVerified: true,
      createdAt: true,
      referralCode: true,
      signupUtmSource: true,
      signupUtmMedium: true,
      signupUtmCampaign: true,
      signupUtmContent: true,
      signupUtmTerm: true,
      referredBy: {
        select: {
          id: true,
          name: true,
          email: true,
          referralCode: true,
        },
      },
      advertiserProfile: {
        select: {
          company: true,
          industry: true,
          billingInfo: true,
        },
      },
      wallet: {
        select: {
          id: true,
          balance: true,
          holdBalance: true,
          currency: true,
        },
      },
      campaigns: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          name: true,
          status: true,
          cpl: true,
          spent: true,
          createdAt: true,
          _count: { select: { leads: true } },
        },
      },
      deposits: {
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          createdAt: true,
          paymentDetails: true,
        },
      },
      _count: { select: { campaigns: true } },
    },
  });

  if (!user) return null;

  return {
    ...user,
    wallet: user.wallet
      ? {
          ...user.wallet,
          balance: Number(user.wallet.balance),
          holdBalance: Number(user.wallet.holdBalance),
        }
      : null,
    campaigns: user.campaigns.map((campaign) => ({
      ...campaign,
      cpl: Number(campaign.cpl),
      spent: Number(campaign.spent),
    })),
    deposits: user.deposits.map((deposit) => ({
      ...deposit,
      amount: Number(deposit.amount),
    })),
    _count: user._count,
  };
}

export async function getPublisherDetail(id: string) {
  const user = await prisma.user.findUnique({
    where: { id, role: "PUBLISHER" },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      createdAt: true,
      publisherProfile: true,
      wallet: {
        select: {
          id: true,
          balance: true,
          holdBalance: true,
          currency: true,
        },
      },
      _count: { select: { leads: true } },
      smartLinkCampaigns: { select: { campaignId: true } },
    },
  });

  if (!user) return null;

  const profile = user.publisherProfile;

  return {
    ...user,
    wallet: user.wallet
      ? {
          ...user.wallet,
          balance: Number(user.wallet.balance),
          holdBalance: Number(user.wallet.holdBalance),
        }
      : null,
    publisherProfile: profile
      ? {
          ...profile,
          ...serializePublisherSpecialTierPayouts(profile),
        }
      : null,
    allowedSmartLinkCampaignIds: user.smartLinkCampaigns.map((row) => row.campaignId) as string[],
    _count: user._count,
  };
}

export async function updatePublisherSpecialPayout(
  userId: string,
  input: {
    useSpecialTierPayouts: boolean;
    tier1SpecialPayout?: number | null;
    tier2SpecialPayout?: number | null;
    tier3SpecialPayout?: number | null;
  },
  adminId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId, role: "PUBLISHER" },
    select: { id: true, publisherProfile: { select: { id: true } } },
  });

  if (!user?.publisherProfile) {
    throw new AppError("NOT_FOUND", "Publisher profile not found", 404);
  }

  const data = input.useSpecialTierPayouts
    ? {
        useSpecialTierPayouts: true,
        tier1SpecialPayout: input.tier1SpecialPayout,
        tier2SpecialPayout: input.tier2SpecialPayout,
        tier3SpecialPayout: input.tier3SpecialPayout,
      }
    : {
        useSpecialTierPayouts: false,
        tier1SpecialPayout: null,
        tier2SpecialPayout: null,
        tier3SpecialPayout: null,
      };

  const profile = await prisma.publisherProfile.update({
    where: { id: user.publisherProfile.id },
    data,
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "publisher.special_payout_updated",
      entityType: "publisher",
      entityId: userId,
      metadata: {
        useSpecialTierPayouts: input.useSpecialTierPayouts,
      },
    },
  });

  return profile;
}

export async function listActiveCampaignsForSmartLinkAllowlist() {
  return prisma.campaign.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      advertiser: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function updatePublisherSmartLinkCampaigns(
  userId: string,
  input: {
    restrictSmartLinkCampaigns: boolean;
    campaignIds: string[];
  },
  adminId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId, role: "PUBLISHER" },
    select: { id: true, publisherProfile: { select: { id: true } } },
  });

  if (!user?.publisherProfile) {
    throw new AppError("NOT_FOUND", "Publisher profile not found", 404);
  }

  const uniqueIds = [...new Set(input.campaignIds.map((id) => id.trim()).filter(Boolean))];

  if (input.restrictSmartLinkCampaigns) {
    if (uniqueIds.length === 0) {
      throw new AppError("VALIDATION_ERROR", "Select at least one campaign", 422);
    }

    const active = await prisma.campaign.findMany({
      where: { id: { in: uniqueIds }, status: "ACTIVE" },
      select: { id: true },
    });
    if (active.length !== uniqueIds.length) {
      throw new AppError("VALIDATION_ERROR", "Select only active campaigns", 422);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.publisherProfile.update({
      where: { id: user.publisherProfile!.id },
      data: { restrictSmartLinkCampaigns: input.restrictSmartLinkCampaigns },
    });
    await tx.publisherSmartLinkCampaign.deleteMany({ where: { publisherId: userId } });
    if (input.restrictSmartLinkCampaigns && uniqueIds.length > 0) {
      await tx.publisherSmartLinkCampaign.createMany({
        data: uniqueIds.map((campaignId) => ({ publisherId: userId, campaignId })),
      });
    }
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "publisher.smart_link_campaigns_updated",
      entityType: "publisher",
      entityId: userId,
      metadata: {
        restrictSmartLinkCampaigns: input.restrictSmartLinkCampaigns,
        campaignCount: input.restrictSmartLinkCampaigns ? uniqueIds.length : 0,
      },
    },
  });

  return {
    restrictSmartLinkCampaigns: input.restrictSmartLinkCampaigns,
    campaignIds: input.restrictSmartLinkCampaigns ? uniqueIds : [],
  };
}

export async function updateUserStatus(userId: string, status: UserStatus, adminId: string) {
  const previous = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, status: true, role: true },
  });

  const user = await prisma.user.update({
    where: { id: userId },
    data: { status },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "user.status_changed",
      entityType: "user",
      entityId: userId,
      metadata: { status },
    },
  });

  if (previous && previous.status !== status) {
    void (async () => {
      if (status === "ACTIVE") {
        await notifyAccountActivated(previous);
      } else if (status === "SUSPENDED") {
        await notifyAccountSuspended(previous);
      }
    })();
  }

  return user;
}

function generateTempPassword() {
  return crypto
    .randomBytes(10)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 12);
}

export async function createPublisherAccount(data: {
  name: string;
  email: string;
  website?: string;
  trafficSource?: string;
  country?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  status?: UserStatus;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });

  if (existing) {
    throw new AppError("AUTH_EMAIL_EXISTS", "Email already registered", 422);
  }

  const email = data.email.trim().toLowerCase();
  const deliverability = await validateEmailDeliverability(email);
  if (!deliverability.ok) {
    throw new AppError("VALIDATION_INVALID_EMAIL", deliverability.reason, 422);
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const status = data.status ?? "PENDING";

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email,
      passwordHash,
      role: "PUBLISHER",
      status,
      wallet: { create: {} },
      publisherProfile: {
        create: {
          website: data.website || undefined,
          trafficSource: data.trafficSource || undefined,
          country: data.country || undefined,
          addressLine1: data.addressLine1 || undefined,
          addressLine2: data.addressLine2 || undefined,
          city: data.city || undefined,
          state: data.state || undefined,
          postalCode: data.postalCode || undefined,
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      publisherProfile: { select: { website: true, trafficSource: true } },
    },
  });

  void (async () => {
    await notifyPublisherCredentials({
      id: user.id,
      email: user.email,
      name: user.name,
      tempPassword,
    });

    const verifyToken = await createEmailVerificationToken(user.id);
    await notifyEmailVerification(
      { id: user.id, email: user.email, name: user.name },
      verifyToken,
    );
  })();

  return { user, tempPassword };
}

export async function createAdvertiserAccount(data: {
  name: string;
  email: string;
  company: string;
  industry?: string;
  status?: UserStatus;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });

  if (existing) {
    throw new AppError("AUTH_EMAIL_EXISTS", "Email already registered", 422);
  }

  const email = data.email.trim().toLowerCase();
  const deliverability = await validateEmailDeliverability(email);
  if (!deliverability.ok) {
    throw new AppError("VALIDATION_INVALID_EMAIL", deliverability.reason, 422);
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const status = data.status ?? "ACTIVE";

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email,
      passwordHash,
      role: "ADVERTISER",
      status,
      wallet: { create: {} },
      advertiserProfile: {
        create: {
          company: data.company,
          industry: data.industry || undefined,
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      advertiserProfile: { select: { company: true, industry: true } },
    },
  });

  void (async () => {
    await notifyAdvertiserCredentials({
      id: user.id,
      email: user.email,
      name: user.name,
      tempPassword,
    });

    const verifyToken = await createEmailVerificationToken(user.id);
    await notifyEmailVerification(
      { id: user.id, email: user.email, name: user.name },
      verifyToken,
    );
  })();

  return { user, tempPassword };
}

export async function listPlatformManagers(filters?: {
  search?: string;
  status?: UserStatus;
  page?: number;
  limit?: number;
}) {
  return listUsers({
    role: "PLATFORM_MANAGER",
    search: filters?.search,
    status: filters?.status,
    page: filters?.page,
    limit: filters?.limit,
  });
}

export async function createPlatformManagerAccount(data: {
  name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  menuAccess?: string[];
}) {
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });

  if (existing) {
    throw new AppError("AUTH_EMAIL_EXISTS", "Email already registered", 422);
  }

  const email = data.email.trim().toLowerCase();
  const deliverability = await validateEmailDeliverability(email);
  if (!deliverability.ok) {
    throw new AppError("VALIDATION_INVALID_EMAIL", deliverability.reason, 422);
  }

  const menuAccess = parseStaffMenuAccess(data.menuAccess);
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      name: data.name.trim(),
      email,
      passwordHash,
      role: "PLATFORM_MANAGER",
      status: "ACTIVE",
      emailVerified: new Date(),
      phone: data.phone?.trim() || null,
      country: data.country?.trim() || null,
      staffMenuAccess: menuAccess,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      country: true,
      role: true,
      status: true,
      staffMenuAccess: true,
      createdAt: true,
    },
  });

  void notifyPlatformManagerCredentials({
    id: user.id,
    email: user.email,
    name: user.name,
    tempPassword,
  });

  return {
    user: {
      ...user,
      staffMenuAccess: parseStaffMenuAccess(user.staffMenuAccess),
    },
    tempPassword,
  };
}

export async function updatePlatformManager(
  userId: string,
  data: {
    name?: string;
    phone?: string | null;
    country?: string | null;
    menuAccess?: string[];
    status?: Extract<UserStatus, "ACTIVE" | "SUSPENDED">;
  },
) {
  const existing = await prisma.user.findFirst({
    where: { id: userId, role: "PLATFORM_MANAGER" },
    select: { id: true, status: true },
  });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Platform manager not found", 404);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
      ...(data.country !== undefined
        ? { country: data.country?.trim() || null }
        : {}),
      ...(data.menuAccess !== undefined
        ? { staffMenuAccess: parseStaffMenuAccess(data.menuAccess) }
        : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      country: true,
      role: true,
      status: true,
      staffMenuAccess: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (data.status && data.status !== existing.status) {
    if (data.status === "SUSPENDED") {
      void notifyAccountSuspended({
        id: updated.id,
        email: updated.email,
        name: updated.name,
      });
    } else if (data.status === "ACTIVE") {
      void notifyAccountActivated({
        id: updated.id,
        email: updated.email,
        name: updated.name,
      });
    }
  }

  return {
    ...updated,
    staffMenuAccess: parseStaffMenuAccess(updated.staffMenuAccess),
  };
}

export async function resendAdvertiserVerificationEmail(userId: string, adminId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      emailVerified: true,
    },
  });

  if (!user || user.role !== "ADVERTISER") {
    throw new AppError("NOT_FOUND", "Advertiser not found", 404);
  }

  if (user.emailVerified) {
    throw new AppError(
      "VALIDATION_ERROR",
      "This advertiser has already verified their email",
      422,
    );
  }

  if (user.status === "SUSPENDED") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Cannot resend verification email to a suspended account",
      422,
    );
  }

  const verifyToken = await createEmailVerificationToken(user.id);
  const result = await notifyEmailVerification(
    { id: user.id, email: user.email, name: user.name },
    verifyToken,
  );

  if (!result.sent) {
    throw new AppError(
      "EMAIL_SEND_FAILED",
      result.error ?? "Failed to send verification email",
      500,
    );
  }

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "advertiser.verification_resent",
      entityType: "user",
      entityId: user.id,
      metadata: { email: user.email },
    },
  });

  return { email: user.email, name: user.name };
}

export type UserDeleteEligibilityInput = {
  id: string;
  role: UserRole;
  wallet?: { balance: number; holdBalance: number } | null;
  _count: {
    campaigns?: number;
    leads?: number;
    deposits?: number;
    payouts?: number;
  };
};

export function getUserDeleteEligibility(
  user: UserDeleteEligibilityInput,
  adminId: string,
  options?: { hasPendingPayout?: boolean },
): { canDelete: boolean; reason?: string } {
  if (user.role === "ADMIN") {
    return { canDelete: false, reason: "Admin accounts cannot be deleted" };
  }

  if (user.id === adminId) {
    return { canDelete: false, reason: "You cannot delete your own account" };
  }

  const balance = Number(user.wallet?.balance ?? 0);
  const hold = Number(user.wallet?.holdBalance ?? 0);
  if (balance > 0 || hold > 0) {
    return {
      canDelete: false,
      reason: "Account has a wallet balance or funds on hold",
    };
  }

  if (user.role === "ADVERTISER") {
    if ((user._count.campaigns ?? 0) > 0) {
      return {
        canDelete: false,
        reason: `Account has ${user._count.campaigns} campaign(s)`,
      };
    }
    if ((user._count.deposits ?? 0) > 0) {
      return {
        canDelete: false,
        reason: `Account has ${user._count.deposits} deposit(s)`,
      };
    }
  }

  if (user.role === "PUBLISHER") {
    if ((user._count.leads ?? 0) > 0) {
      return {
        canDelete: false,
        reason: `Account has ${user._count.leads} lead(s)`,
      };
    }
    if ((user._count.payouts ?? 0) > 0) {
      return {
        canDelete: false,
        reason: `Account has ${user._count.payouts} payout request(s)`,
      };
    }
    if (options?.hasPendingPayout) {
      return {
        canDelete: false,
        reason: "Account has a pending payout request",
      };
    }
  }

  return { canDelete: true };
}

export async function deleteManagedUser(userId: string, adminId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      email: true,
      name: true,
      wallet: { select: { balance: true, holdBalance: true } },
      _count: { select: { campaigns: true, leads: true, deposits: true, payouts: true } },
    },
  });

  if (!user) {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }

  const pendingPayout =
    user.role === "PUBLISHER"
      ? await prisma.payout.findFirst({
          where: {
            publisherId: userId,
            status: { in: [...PENDING_PAYOUT_STATUSES] },
          },
          select: { id: true },
        })
      : null;

  const eligibility = getUserDeleteEligibility(
    {
      id: user.id,
      role: user.role,
      wallet: user.wallet
        ? {
            balance: Number(user.wallet.balance),
            holdBalance: Number(user.wallet.holdBalance),
          }
        : null,
      _count: user._count,
    },
    adminId,
    { hasPendingPayout: Boolean(pendingPayout) },
  );

  if (!eligibility.canDelete) {
    throw new AppError(
      "USER_DELETE_BLOCKED",
      eligibility.reason ?? "This account cannot be deleted",
      422,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.impersonationToken.deleteMany({
      where: { OR: [{ adminId: userId }, { targetUserId: userId }] },
    });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.emailVerificationToken.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.ticketMessage.deleteMany({ where: { senderId: userId } });
    await tx.supportTicket.deleteMany({ where: { userId } });
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "user.deleted",
        entityType: "user",
        entityId: userId,
        metadata: { email: user.email, role: user.role },
      },
    });
    await tx.user.delete({ where: { id: userId } });
  });

  return { id: userId };
}

export async function approvePublisher(userId: string, adminId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: "ACTIVE" },
    select: { id: true, email: true, name: true },
  });

  await prisma.publisherProfile.updateMany({
    where: { userId },
    data: { rejectionReason: null, rejectedAt: null },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "publisher.approved",
      entityType: "user",
      entityId: userId,
      metadata: { status: "ACTIVE" },
    },
  });

  void notifyApproved(user, "Publisher account", undefined, "publisher.approved");

  return user;
}

export async function rejectPublisher(
  userId: string,
  adminId: string,
  reason: string,
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED" },
    select: { id: true, email: true, name: true },
  });

  await prisma.publisherProfile.updateMany({
    where: { userId },
    data: { rejectionReason: reason, rejectedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "publisher.rejected",
      entityType: "user",
      entityId: userId,
      metadata: { status: "SUSPENDED", reason },
    },
  });

  void notifyRejected(user, "Publisher account", reason, undefined, "publisher.rejected");

  return user;
}

export async function approveCampaign(campaignId: string, adminId: string) {
  const existing = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });

  if (!existing) {
    throw new AppError("CAMPAIGN_NOT_FOUND", "Campaign not found", 404);
  }

  if (existing.status !== "PENDING") {
    throw new AppError(
      "CAMPAIGN_INVALID_STATUS",
      "Only pending campaigns can be approved",
      422,
    );
  }

  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: "ACTIVE",
      rejectionReason: null,
      rejectedAt: null,
    },
    include: { advertiser: { select: { id: true, email: true, name: true } } },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "campaign.approved",
      entityType: "campaign",
      entityId: campaignId,
      metadata: { status: "ACTIVE" },
    },
  });

  void notifyCampaignApproved(campaign.advertiser, {
    campaignId: campaign.id,
    campaignName: campaign.name,
  });

  return campaign;
}

export async function rejectCampaign(
  campaignId: string,
  adminId: string,
  reason: string,
) {
  const existing = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });

  if (!existing) {
    throw new AppError("CAMPAIGN_NOT_FOUND", "Campaign not found", 404);
  }

  if (existing.status !== "PENDING") {
    throw new AppError(
      "CAMPAIGN_INVALID_STATUS",
      "Only pending campaigns can be rejected",
      422,
    );
  }

  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: "ARCHIVED",
      rejectionReason: reason,
      rejectedAt: new Date(),
    },
    include: { advertiser: { select: { id: true, email: true, name: true } } },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "campaign.rejected",
      entityType: "campaign",
      entityId: campaignId,
      metadata: { status: "ARCHIVED", reason },
    },
  });

  void notifyCampaignRejected(campaign.advertiser, {
    campaignId: campaign.id,
    campaignName: campaign.name,
    reason,
  });

  return campaign;
}

export async function getPlatformSettingsRecord() {
  const settings = await prisma.platformSetting.findMany();
  const map: Record<string, unknown> = {};
  for (const s of settings) map[s.key] = s.value;
  return parsePlatformSettings(map);
}

export async function updatePlatformSettings(
  data: {
    publisherPayoutPercent?: number;
    minPayoutAmount?: number;
    minPayoutWise?: number;
    minPayoutBankTransfer?: number;
    minPayoutStripeConnect?: number;
    tier1PayoutMin?: number;
    tier1PayoutMax?: number;
    tier2PayoutMin?: number;
    tier2PayoutMax?: number;
    tier3PayoutMin?: number;
    tier3PayoutMax?: number;
    globalLinkUrl?: string | null;
  },
  adminId: string,
) {
  const updates = platformSettingsToUpdates(data);

  for (const u of updates) {
    await prisma.platformSetting.upsert({
      where: { key: u.key },
      create: { key: u.key, value: u.value as never },
      update: { value: u.value as never },
    });
  }

  if (updates.length > 0) {
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: "settings.updated",
        entityType: "platform_settings",
        entityId: "global",
        metadata: data,
      },
    });
  }

  return getPlatformSettingsRecord();
}

export async function getPlatformSettingsResponse() {
  const config = await getPlatformSettingsRecord();
  return settingsConfigToApi(config);
}

export type CampaignSort = "cpl_asc" | "cpl_desc" | "created_desc";

export async function listCampaigns(filters: {
  search?: string;
  status?: CampaignStatus | "STOP";
  cplMin?: number;
  cplMax?: number;
  dateFrom?: Date;
  dateTo?: Date;
  sort?: CampaignSort;
  page?: number;
  limit?: number;
}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;

  const where: Prisma.CampaignWhereInput = {};

  if (filters.status === "STOP") {
    where.status = { in: ["COMPLETED", "ARCHIVED"] };
  } else if (filters.status) {
    where.status = filters.status;
  }

  if (filters.search?.trim()) {
    const term = filters.search.trim();
    where.OR = [
      { name: { contains: term } },
      { advertiser: { name: { contains: term } } },
      { advertiser: { email: { contains: term } } },
    ];
  }

  if (filters.cplMin !== undefined || filters.cplMax !== undefined) {
    where.cpl = {};
    if (filters.cplMin !== undefined) where.cpl.gte = filters.cplMin;
    if (filters.cplMax !== undefined) where.cpl.lte = filters.cplMax;
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

  const orderBy: Prisma.CampaignOrderByWithRelationInput =
    filters.sort === "cpl_asc"
      ? { cpl: "asc" }
      : filters.sort === "cpl_desc"
        ? { cpl: "desc" }
        : { createdAt: "desc" };

  const [data, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      include: {
        advertiser: { select: { name: true, email: true } },
        fields: { orderBy: { sortOrder: "asc" } },
        optinPages: {
          select: { slug: true },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
        _count: { select: { leads: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.campaign.count({ where }),
  ]);

  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function listAuditLogs(filters: { page?: number; limit?: number }) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count(),
  ]);

  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

type BulkEmailMeta = {
  subject?: string;
  recipientCount?: number;
  sent?: number;
  failed?: number;
  skipped?: number;
  audience?: string;
};

function parseBulkEmailMeta(metadata: unknown): {
  subject: string;
  sent: number;
  failed: number;
  skipped: number;
  audience: string;
} {
  const m =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as BulkEmailMeta)
      : {};
  const audienceRaw = typeof m.audience === "string" ? m.audience : "";
  const audience =
    audienceRaw === "ADVERTISER" || audienceRaw === "PUBLISHER" || audienceRaw === "MIXED"
      ? audienceRaw
      : "—";
  return {
    subject: typeof m.subject === "string" ? m.subject : "(no subject)",
    sent: typeof m.sent === "number" ? m.sent : 0,
    failed: typeof m.failed === "number" ? m.failed : 0,
    skipped: typeof m.skipped === "number" ? m.skipped : 0,
    audience,
  };
}

export async function getAdminBulkEmailReport() {
  const logs = await prisma.auditLog.findMany({
    where: { action: "email.bulk_sent" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const rows = logs.map((log) => {
    const meta = parseBulkEmailMeta(log.metadata);
    return {
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      subject: meta.subject,
      audience: meta.audience,
      sent: meta.sent,
      failed: meta.failed,
      skipped: meta.skipped,
    };
  });

  return { rows };
}

export async function adjustWallet(
  userId: string,
  amount: number,
  type: "CREDIT" | "DEBIT",
  reason: string,
  adminId: string,
) {
  const { creditWallet, debitWallet } = await import("@/services/wallet.service");
  const { notifyLowBalanceTiers } = await import("@/services/notify.service");

  let crossedTiers: number[] = [];
  let newBalance = 0;

  await prisma.$transaction(async (tx) => {
    if (type === "CREDIT") {
      await creditWallet(tx, userId, amount, "adjustment", adminId, reason);
    } else {
      const debit = await debitWallet(tx, userId, amount, "adjustment", adminId, reason);
      crossedTiers = debit.crossedTiers;
      newBalance = debit.newBalance;
    }

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "wallet.adjusted",
        entityType: "wallet",
        entityId: userId,
        metadata: { amount, type, reason },
      },
    });
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  const walletPath =
    user?.role === "PUBLISHER" ? "/publisher/earnings" : "/advertiser/wallet";

  void notifyUserById(userId, {
    title: "Wallet adjustment",
    message: `An admin ${type === "CREDIT" ? "credited" : "debited"} $${amount.toFixed(2)} to your wallet. Reason: ${reason}`,
    actionPath: walletPath,
    notificationType: "wallet.adjusted",
  });

  if (user?.role === "ADVERTISER" && crossedTiers.length > 0) {
    void notifyLowBalanceTiers(userId, crossedTiers as (50 | 10 | 0)[], newBalance);
  }
}

export async function listBulkEmailRecipients(role: "ADVERTISER" | "PUBLISHER") {
  const data = await prisma.user.findMany({
    where: { role, status: "ACTIVE" },
    select: { id: true, name: true, email: true, role: true, status: true },
    orderBy: { name: "asc" },
    take: 5000,
  });
  return { data };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const idx = next;
      next += 1;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

export async function sendAdminBulkEmail(input: {
  userIds: string[];
  subject: string;
  message: string;
  actorId: string;
}) {
  const uniqueIds = Array.from(new Set(input.userIds));
  const users = await prisma.user.findMany({
    where: {
      id: { in: uniqueIds },
      role: { in: ["ADVERTISER", "PUBLISHER"] },
      status: "ACTIVE",
    },
    select: { id: true, email: true, name: true, role: true },
  });

  if (users.length === 0) {
    throw new AppError("VALIDATION_ERROR", "No active recipients found for the selected users", 422);
  }

  const { getResolvedEmailConfig } = await import("@/services/smtp-settings.service");
  const { sendEmail, getSupportEmail, getSupportFromEmail } = await import("@/services/email.service");
  const { renderGenericEmail } = await import("@/lib/email/templates");
  const { formatSupportFrom } = await import("@/lib/email/addresses");

  const config = await getResolvedEmailConfig();
  const supportReplyTo = await getSupportEmail();
  if (!supportReplyTo) {
    throw new AppError("VALIDATION_ERROR", "Support email is not configured", 422);
  }
  const supportFrom = await getSupportFromEmail();
  if (!supportFrom) {
    throw new AppError("VALIDATION_ERROR", "Support email is not configured", 422);
  }
  const from = formatSupportFrom(supportFrom);
  const htmlMessage = input.message.trim();

  const outcomes = await mapPool(users, 8, async (user) => {
    const rendered = renderGenericEmail({
      appUrl: config.appUrl,
      recipientName: user.name,
      title: input.subject,
      message: htmlMessage,
    });

    const result = await sendEmail({
      to: user.email,
      subject: input.subject,
      html: rendered.html,
      text: rendered.text,
      template: "generic",
      from,
      replyTo: supportReplyTo,
      metadata: {
        kind: "admin_bulk_email",
        userId: user.id,
        role: user.role,
      },
    });

    if (result.skipped) return "skipped" as const;
    if (result.sent) return "sent" as const;
    return "failed" as const;
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const outcome of outcomes) {
    if (outcome === "sent") sent += 1;
    else if (outcome === "skipped") skipped += 1;
    else failed += 1;
  }

  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "email.bulk_sent",
        entityType: "email",
        entityId: input.actorId,
        metadata: {
          subject: input.subject,
          recipientCount: users.length,
          sent,
          failed,
          skipped,
          audience: users.every((user) => user.role === "PUBLISHER")
            ? "PUBLISHER"
            : users.every((user) => user.role === "ADVERTISER")
              ? "ADVERTISER"
              : "MIXED",
          userIds: users.map((user) => user.id),
        },
      },
    });
  } catch (error) {
    console.error("[admin:bulk-email] audit log failed", error);
  }

  if (sent === 0 && failed > 0) {
    throw new AppError(
      "INTERNAL_ERROR",
      `Failed to send email to all ${failed} recipient${failed === 1 ? "" : "s"}. Check Mailgun/SMTP configuration.`,
      500,
    );
  }

  return {
    recipientCount: users.length,
    sent,
    failed,
    skipped,
    notFound: uniqueIds.length - users.length,
  };
}

export async function sendAdminBulkEmailTest(input: {
  to: string;
  subject: string;
  message: string;
  actorId: string;
}) {
  const { getResolvedEmailConfig } = await import("@/services/smtp-settings.service");
  const { sendEmail, getSupportEmail, getSupportFromEmail } = await import("@/services/email.service");
  const { renderGenericEmail } = await import("@/lib/email/templates");
  const { formatSupportFrom } = await import("@/lib/email/addresses");

  const config = await getResolvedEmailConfig();
  const supportReplyTo = await getSupportEmail();
  if (!supportReplyTo) {
    throw new AppError("VALIDATION_ERROR", "Support email is not configured", 422);
  }
  const supportFrom = await getSupportFromEmail();
  if (!supportFrom) {
    throw new AppError("VALIDATION_ERROR", "Support email is not configured", 422);
  }
  const from = formatSupportFrom(supportFrom);
  const htmlMessage = input.message.trim();

  const rendered = renderGenericEmail({
    appUrl: config.appUrl,
    recipientName: "there",
    title: input.subject,
    message: htmlMessage,
  });

  const result = await sendEmail({
    to: input.to,
    subject: `[Test] ${input.subject}`,
    html: rendered.html,
    text: rendered.text,
    template: "generic",
    from,
    replyTo: supportReplyTo,
    metadata: {
      kind: "admin_bulk_email_test",
      actorId: input.actorId,
    },
  });

  if (result.skipped) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Email provider is not configured. Configure Mailgun/SMTP first.",
      422,
    );
  }
  if (!result.sent) {
    throw new AppError(
      "INTERNAL_ERROR",
      result.error ?? "Failed to send test email",
      500,
    );
  }

  return { sent: true, to: input.to };
}

// ---------------------------------------------------------------------------
// Admin Dashboard Stats
// ---------------------------------------------------------------------------

export type AdminRevenuePoint = {
  date: string;
  label: string;
  revenue: number;
};

export type AdminDepositRow = {
  id: string;
  userName: string;
  userEmail: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
};

export type AdminSignupRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

export type AdminPayoutRow = {
  id: string;
  publisherName: string;
  publisherEmail: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
};

export type AdminDashboardStats = {
  totalUsers: number;
  activeUsers: number;
  totalRevenue: number;
  totalPayouts: number;
  totalLeads: number;
  approvedLeads: number;
  recentSignups: AdminSignupRow[];
  recentDeposits: AdminDepositRow[];
  pendingPayouts: AdminPayoutRow[];
  revenueSeries: AdminRevenuePoint[];
};

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const [
    totalUsers,
    activeUsers,
    totalLeads,
    approvedLeads,
    revenueAgg,
    payoutsAgg,
    recentSignupsRaw,
    recentDepositsRaw,
    pendingPayoutsRaw,
    revenueSeriesRaw,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.lead.count(),
    prisma.lead.count({ where: { status: "APPROVED" } }),
    prisma.deposit.aggregate({
      _sum: { amount: true },
      where: { status: "COMPLETED" },
    }),
    prisma.payout.aggregate({
      _sum: { amount: true },
      where: { status: { in: ["PROCESSING", "COMPLETED"] } },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    prisma.deposit.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.payout.findMany({
      where: { status: { in: ["PENDING", "REQUESTED", "PROCESSING"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { publisher: { select: { name: true, email: true } } },
    }),
    // Revenue per day for the last 30 days
    prisma.deposit.groupBy({
      by: ["createdAt"],
      _sum: { amount: true },
      where: {
        status: "COMPLETED",
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  // Aggregate revenue series by calendar day
  const dayMap = new Map<string, number>();
  for (const row of revenueSeriesRaw) {
    const day = row.createdAt.toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + Number(row._sum.amount ?? 0));
  }
  const revenueSeries: AdminRevenuePoint[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({
      date,
      label: new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric" }).format(
        new Date(date),
      ),
      revenue: Math.round(revenue * 100) / 100,
    }));

  return {
    totalUsers,
    activeUsers,
    totalLeads,
    approvedLeads,
    totalRevenue: Number(revenueAgg._sum.amount ?? 0),
    totalPayouts: Number(payoutsAgg._sum.amount ?? 0),
    recentSignups: recentSignupsRaw.map((u) => ({
      id: u.id,
      name: u.name ?? u.email,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
    })),
    recentDeposits: recentDepositsRaw.map((d) => ({
      id: d.id,
      userName: d.user.name ?? d.user.email,
      userEmail: d.user.email,
      amount: Number(d.amount),
      method: d.method,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
    })),
    pendingPayouts: pendingPayoutsRaw.map((p) => ({
      id: p.id,
      publisherName: p.publisher.name ?? p.publisher.email,
      publisherEmail: p.publisher.email,
      amount: Number(p.amount),
      method: p.method,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    })),
    revenueSeries,
  };
}
