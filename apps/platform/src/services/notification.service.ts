import { prisma } from "@/lib/prisma";
import type { TicketCategory } from "@prisma/client";
import { isAdminPortalRole } from "@/lib/admin-portal";
import { notifyAdminAlert, notifyGeneric } from "@/services/notify.service";
import { getSupportEmail } from "@/services/email.service";

const TICKET_CATEGORIES: TicketCategory[] = [
  "GENERAL",
  "BILLING",
  "TECHNICAL",
  "CAMPAIGN",
  "PAYOUT",
  "OTHER",
];

function normalizeTicketCategory(category: TicketCategory | string): TicketCategory {
  const normalized = String(category).trim().toUpperCase() as TicketCategory;
  return TICKET_CATEGORIES.includes(normalized) ? normalized : "OTHER";
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
) {
  return prisma.notification.create({
    data: { userId, type, title, body },
  });
}

export async function listNotifications(userId: string, unreadOnly = false) {
  return prisma.notification.findMany({
    where: {
      userId,
      ...(unreadOnly && { readAt: null }),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

const DASHBOARD_ALERT_TYPES = [
  "wallet.low_balance.50",
  "wallet.low_balance.10",
  "wallet.low_balance.0",
  "campaign.budget_reached",
  "campaign.paused",
] as const;

export async function listAdvertiserDashboardAlerts(userId: string, take = 5) {
  return prisma.notification.findMany({
    where: {
      userId,
      readAt: null,
      type: { in: [...DASHBOARD_ALERT_TYPES] },
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      createdAt: true,
    },
  });
}

export async function markNotificationRead(id: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { readAt: new Date() },
  });
}

export async function createTicket(
  userId: string,
  subject: string,
  category: TicketCategory | string,
  body: string,
) {
  const ticketCategory = normalizeTicketCategory(category);

  return prisma.supportTicket.create({
    data: {
      userId,
      subject: subject.trim(),
      category: ticketCategory,
      messages: {
        create: { senderId: userId, body: body.trim() },
      },
    },
    include: { messages: true, user: { select: { id: true, email: true, name: true } } },
  }).then(async (ticket) => {
    void notifyAdminAlert({
      title: "New support ticket",
      message: `${ticket.user.name} opened "${ticket.subject}" (${ticketCategory}).`,
      actionPath: "/admin/support",
      metadata: { ticketId: ticket.id },
    });
    return ticket;
  });
}

export async function listTickets(filters: {
  userId?: string;
  status?: string;
  page?: number;
  hideInternal?: boolean;
}) {
  const page = filters.page ?? 1;
  const where = {
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.status && { status: filters.status as never }),
  };

  return prisma.supportTicket.findMany({
    where,
    include: {
      user: { select: { name: true, email: true, role: true } },
      messages: {
        where: filters.hideInternal ? { isInternal: false } : undefined,
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { name: true, role: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * 20,
    take: 20,
  });
}

export async function addTicketMessage(
  ticketId: string,
  senderId: string,
  body: string,
  isInternal = false,
) {
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { role: true },
  });

  await prisma.ticketMessage.create({
    data: { ticketId, senderId, body: body.trim(), isInternal },
  });

  const staffReply = isAdminPortalRole(sender?.role) && !isInternal;
  const statusUpdate = staffReply ? { status: "IN_PROGRESS" as const } : {};

  return prisma.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date(), ...statusUpdate },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { name: true, role: true } } },
      },
      user: { select: { name: true, email: true, role: true, id: true } },
    },
  }).then(async (ticket) => {
    if (isInternal) return ticket;

    if (isAdminPortalRole(sender?.role)) {
      const supportPath =
        ticket.user.role === "ADVERTISER" ? "/advertiser/support" : "/publisher/support";
      const supportEmail = await getSupportEmail();
      void notifyGeneric(
        { id: ticket.user.id, email: ticket.user.email, name: ticket.user.name },
        {
          title: "Support reply",
          message: `Admin replied to your ticket "${ticket.subject}".`,
          actionPath: supportPath,
          notificationType: "support.reply",
          replyTo: supportEmail ?? undefined,
        },
      );
    } else {
      void notifyAdminAlert({
        title: "Support ticket reply",
        message: `${ticket.user.name} replied to "${ticket.subject}".`,
        actionPath: "/admin/support",
        metadata: { ticketId },
      });
    }

    return ticket;
  });
}

export async function getTicketForUser(ticketId: string, userId: string, isAdmin: boolean) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, userId: true, status: true },
  });

  if (!ticket) return null;
  if (!isAdmin && ticket.userId !== userId) return null;
  return ticket;
}

export async function closeSupportTicket(ticketId: string) {
  const existing = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { status: true },
  });

  if (!existing) return null;
  if (existing.status === "CLOSED") {
    return prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { name: true, role: true } } },
        },
        user: { select: { name: true, email: true, role: true, id: true } },
      },
    });
  }

  return prisma.supportTicket
    .update({
      where: { id: ticketId },
      data: { status: "CLOSED", updatedAt: new Date() },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { name: true, role: true } } },
        },
        user: { select: { name: true, email: true, role: true, id: true } },
      },
    })
    .then(async (ticket) => {
      const supportPath =
        ticket.user.role === "ADVERTISER" ? "/advertiser/support" : "/publisher/support";
      void notifyGeneric(
        { id: ticket.user.id, email: ticket.user.email, name: ticket.user.name },
        {
          title: "Support ticket closed",
          message: `Your ticket "${ticket.subject}" has been closed by our support team.`,
          actionPath: supportPath,
          notificationType: "support.closed",
        },
      );
      return ticket;
    });
}
