import type { EmailContactStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateUnsubscribeToken } from "../lib/tokens";

function extractLeadFields(data: Record<string, unknown>) {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const val = data[key];
      if (typeof val === "string" && val.trim()) return val.trim();
    }
    return undefined;
  };

  return {
    email: get("email", "Email", "EMAIL")?.toLowerCase(),
    firstName: get("first_name", "firstName", "FirstName", "fname"),
    lastName: get("last_name", "lastName", "LastName", "lname"),
    phone: get("phone", "Phone", "mobile"),
  };
}

export async function upsertContactFromLead(input: {
  advertiserId: string;
  leadId: string;
  campaignId: string;
  data: Record<string, unknown>;
  consentSource?: string;
}) {
  const fields = extractLeadFields(input.data);
  if (!fields.email) return null;

  const existing = await prisma.emailContact.findUnique({
    where: {
      advertiserId_email: {
        advertiserId: input.advertiserId,
        email: fields.email,
      },
    },
  });

  if (
    existing &&
    ["UNSUBSCRIBED", "BOUNCED", "COMPLAINED"].includes(existing.status)
  ) {
    return existing;
  }

  const customMeta = { ...input.data };
  for (const key of ["email", "first_name", "last_name", "phone", "Email", "firstName", "lastName"]) {
    delete customMeta[key];
  }

  return prisma.emailContact.upsert({
    where: {
      advertiserId_email: {
        advertiserId: input.advertiserId,
        email: fields.email,
      },
    },
    create: {
      advertiserId: input.advertiserId,
      email: fields.email,
      firstName: fields.firstName,
      lastName: fields.lastName,
      phone: fields.phone,
      consentSource: input.consentSource ?? "lead_capture",
      sourceLeadId: input.leadId,
      sourceCampaignId: input.campaignId,
      metadata: (Object.keys(customMeta).length ? customMeta : undefined) as Prisma.InputJsonValue | undefined,
      unsubscribeToken: generateUnsubscribeToken(),
      status: "SUBSCRIBED",
    },
    update: {
      firstName: fields.firstName ?? undefined,
      lastName: fields.lastName ?? undefined,
      phone: fields.phone ?? undefined,
      sourceLeadId: input.leadId,
      sourceCampaignId: input.campaignId,
      metadata: (Object.keys(customMeta).length ? customMeta : undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function listContacts(
  advertiserId: string,
  opts: {
    page: number;
    limit: number;
    search?: string;
    status?: EmailContactStatus;
    sourceCampaignId?: string;
    listId?: string;
  },
) {
  let sourceCampaignId = opts.sourceCampaignId;
  if (opts.listId && opts.listId !== "all") {
    const list = await prisma.emailList.findFirst({
      where: { id: opts.listId, advertiserId },
      select: { campaignId: true },
    });
    if (!list) {
      return { items: [], total: 0, page: opts.page, limit: opts.limit };
    }
    sourceCampaignId = list.campaignId;
  }

  const where = {
    advertiserId,
    ...(opts.status ? { status: opts.status } : {}),
    ...(sourceCampaignId ? { sourceCampaignId } : {}),
    ...(opts.search
      ? {
          OR: [
            { email: { contains: opts.search } },
            { firstName: { contains: opts.search } },
            { lastName: { contains: opts.search } },
          ],
        }
      : {}),
  };

  const [items, total, subscribedCount] = await Promise.all([
    prisma.emailContact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        sourceCampaignId: true,
        createdAt: true,
      },
    }),
    prisma.emailContact.count({ where }),
    prisma.emailContact.count({
      where: { ...where, status: "SUBSCRIBED" },
    }),
  ]);

  return {
    items,
    total,
    subscribedCount,
    page: opts.page,
    limit: opts.limit,
  };
}

export async function getContactByUnsubscribeToken(token: string) {
  return prisma.emailContact.findUnique({
    where: { unsubscribeToken: token },
    select: {
      id: true,
      email: true,
      status: true,
      unsubscribedAt: true,
    },
  });
}

export async function unsubscribeByToken(token: string) {
  const contact = await prisma.emailContact.findUnique({
    where: { unsubscribeToken: token },
  });
  if (!contact) return null;

  if (contact.status === "UNSUBSCRIBED") return contact;

  return prisma.emailContact.update({
    where: { id: contact.id },
    data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
  });
}

/** Mark an existing subscribed contact as unsubscribed (suppression UI). */
export async function suppressContactByEmail(
  advertiserId: string,
  email: string,
) {
  const normalized = email.trim().toLowerCase();
  const contact = await prisma.emailContact.findUnique({
    where: {
      advertiserId_email: { advertiserId, email: normalized },
    },
  });
  if (!contact) return null;
  if (contact.status === "UNSUBSCRIBED") return contact;
  return prisma.emailContact.update({
    where: { id: contact.id },
    data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
  });
}

export async function suppressContact(
  email: string,
  status: "BOUNCED" | "COMPLAINED",
) {
  const contacts = await prisma.emailContact.findMany({
    where: { email: email.toLowerCase() },
  });

  await Promise.all(
    contacts.map((c) =>
      prisma.emailContact.update({
        where: { id: c.id },
        data: { status },
      }),
    ),
  );
}

export async function getContactById(advertiserId: string, id: string) {
  return prisma.emailContact.findFirst({
    where: { id, advertiserId },
  });
}
