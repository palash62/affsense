import { Prisma, type AffiliateInvoiceStatus, type PayoutMethod } from "@prisma/client";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import { invoiceWeekStart, resolveInvoicePeriod } from "@/lib/affiliate-invoice-period";

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function moneyToString(n: number): string {
  return round4(n).toFixed(4);
}

async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  issuedAt: Date,
): Promise<string> {
  const year = issuedAt.getUTCFullYear();
  const prefix = `ADV-CPA-${year}-`;
  const used = await tx.advertiserCpaInvoice.count({
    where: { number: { startsWith: prefix } },
  });
  return `${prefix}${String(used + 1).padStart(5, "0")}`;
}

export type SerializedAdvertiserCpaInvoice = {
  id: string;
  number: string;
  advertiserId: string;
  advertiserName: string;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  dueAt: string;
  subtotal: string;
  total: string;
  currency: string;
  status: AffiliateInvoiceStatus;
  paidAt: string | null;
  paymentMethod: PayoutMethod | null;
  paymentReference: string | null;
  adminNote: string | null;
  lines: {
    id: string;
    offerId: string | null;
    description: string;
    conversionCount: number;
    amount: string;
  }[];
};

function serializeInvoice(row: {
  id: string;
  number: string;
  advertiserId: string;
  periodStart: Date;
  periodEnd: Date;
  issuedAt: Date;
  dueAt: Date;
  subtotal: { toString(): string };
  total: { toString(): string };
  currency: string;
  status: AffiliateInvoiceStatus;
  paidAt: Date | null;
  paymentMethod: PayoutMethod | null;
  paymentReference: string | null;
  adminNote: string | null;
  advertiser?: { name: string } | null;
  lines: {
    id: string;
    offerId: string | null;
    description: string;
    conversionCount: number;
    amount: { toString(): string };
  }[];
}): SerializedAdvertiserCpaInvoice {
  return {
    id: row.id,
    number: row.number,
    advertiserId: row.advertiserId,
    advertiserName: row.advertiser?.name ?? "Advertiser",
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    issuedAt: row.issuedAt.toISOString(),
    dueAt: row.dueAt.toISOString(),
    subtotal: Number(row.subtotal).toFixed(2),
    total: Number(row.total).toFixed(2),
    currency: row.currency,
    status: row.status,
    paidAt: row.paidAt?.toISOString() ?? null,
    paymentMethod: row.paymentMethod,
    paymentReference: row.paymentReference,
    adminNote: row.adminNote,
    lines: row.lines.map((line) => ({
      id: line.id,
      offerId: line.offerId,
      description: line.description,
      conversionCount: line.conversionCount,
      amount: Number(line.amount).toFixed(2),
    })),
  };
}

export type GenerateAdvertiserCpaInvoicesResult = {
  periodEnd: string;
  created: number;
  skipped: number;
  failed: number;
  totalAmount: number;
  invoices: { id: string; number: string; advertiserId: string; total: number }[];
  errors: { advertiserId: string; message: string }[];
};

/**
 * Raise AR invoices for offer-owner advertisers for conversions in the last
 * completed Mon–Sun week that are not yet billed (advertiserInvoiceId null).
 * Amount = sum of offer.revenue per conversion. No wallet debit (offline pay).
 */
export async function generateAdvertiserCpaInvoices(
  runAt: Date = new Date(),
  timezone = "UTC",
): Promise<GenerateAdvertiserCpaInvoicesResult> {
  const { periodEnd, periodEndExclusive } = resolveInvoicePeriod(runAt, timezone);
  const periodStart = invoiceWeekStart(
    new Date(periodEndExclusive.getTime() - 7 * 24 * 60 * 60 * 1000),
    timezone,
  );
  const periodKey = periodEnd.toISOString();
  const issuedAt = new Date();
  const dueAt = addDays(issuedAt, 7);

  const unbilled = await prisma.cpaOfferConversion.findMany({
    where: {
      advertiserInvoiceId: null,
      createdAt: { gte: periodStart, lt: periodEndExclusive },
      offer: { ownerAdvertiserId: { not: null } },
    },
    select: {
      id: true,
      offerId: true,
      offer: {
        select: {
          name: true,
          revenue: true,
          ownerAdvertiserId: true,
        },
      },
    },
  });

  const byOwner = new Map<
    string,
    {
      conversions: { id: string; offerId: string; offerName: string; revenue: number }[];
    }
  >();

  for (const row of unbilled) {
    const ownerId = row.offer.ownerAdvertiserId;
    if (!ownerId) continue;
    const bucket = byOwner.get(ownerId) ?? { conversions: [] };
    bucket.conversions.push({
      id: row.id,
      offerId: row.offerId,
      offerName: row.offer.name,
      revenue: Number(row.offer.revenue ?? 0),
    });
    byOwner.set(ownerId, bucket);
  }

  const result: GenerateAdvertiserCpaInvoicesResult = {
    periodEnd: periodEnd.toISOString(),
    created: 0,
    skipped: 0,
    failed: 0,
    totalAmount: 0,
    invoices: [],
    errors: [],
  };

  for (const [advertiserId, bucket] of byOwner.entries()) {
    const total = round4(
      bucket.conversions.reduce((sum, c) => sum + c.revenue, 0),
    );
    if (total <= 0) {
      result.skipped += 1;
      continue;
    }

    const byOffer = new Map<
      string,
      { offerId: string; offerName: string; count: number; amount: number }
    >();
    for (const c of bucket.conversions) {
      const cur = byOffer.get(c.offerId) ?? {
        offerId: c.offerId,
        offerName: c.offerName,
        count: 0,
        amount: 0,
      };
      cur.count += 1;
      cur.amount = round4(cur.amount + c.revenue);
      byOffer.set(c.offerId, cur);
    }

    try {
      const created = await prisma.$transaction(async (tx) => {
        const existing = await tx.advertiserCpaInvoice.findUnique({
          where: {
            advertiserId_periodKey: { advertiserId, periodKey },
          },
        });
        if (existing) {
          return null;
        }

        const number = await nextInvoiceNumber(tx, issuedAt);
        const invoice = await tx.advertiserCpaInvoice.create({
          data: {
            number,
            advertiserId,
            periodStart,
            periodEnd,
            periodKey,
            issuedAt,
            dueAt,
            subtotal: total,
            total,
            currency: "USD",
            status: "UNPAID",
            lines: {
              create: [...byOffer.values()].map((line) => ({
                offerId: line.offerId,
                description: line.offerName,
                conversionCount: line.count,
                amount: line.amount,
              })),
            },
          },
        });

        await tx.cpaOfferConversion.updateMany({
          where: { id: { in: bucket.conversions.map((c) => c.id) } },
          data: { advertiserInvoiceId: invoice.id },
        });

        return invoice;
      });

      if (!created) {
        result.skipped += 1;
        continue;
      }

      result.created += 1;
      result.totalAmount = round4(result.totalAmount + total);
      result.invoices.push({
        id: created.id,
        number: created.number,
        advertiserId,
        total,
      });
    } catch (error) {
      result.failed += 1;
      result.errors.push({
        advertiserId,
        message: error instanceof Error ? error.message : "Failed to create invoice",
      });
    }
  }

  return result;
}

export async function listAdvertiserCpaInvoicesForAdvertiser(
  advertiserId: string,
  opts: { page?: number; limit?: number } = {},
): Promise<{
  items: SerializedAdvertiserCpaInvoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));

  const where = { advertiserId };
  const [total, rows] = await Promise.all([
    prisma.advertiserCpaInvoice.count({ where }),
    prisma.advertiserCpaInvoice.findMany({
      where,
      include: {
        advertiser: { select: { name: true } },
        lines: { orderBy: { description: "asc" } },
      },
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: rows.map(serializeInvoice),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function listAdvertiserCpaInvoicesForAdmin(opts: {
  page?: number;
  limit?: number;
  status?: AffiliateInvoiceStatus | "ALL";
  advertiserId?: string;
} = {}): Promise<{
  items: SerializedAdvertiserCpaInvoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const where: Prisma.AdvertiserCpaInvoiceWhereInput = {};
  if (opts.status && opts.status !== "ALL") where.status = opts.status;
  if (opts.advertiserId?.trim()) where.advertiserId = opts.advertiserId.trim();

  const [total, rows] = await Promise.all([
    prisma.advertiserCpaInvoice.count({ where }),
    prisma.advertiserCpaInvoice.findMany({
      where,
      include: {
        advertiser: { select: { name: true } },
        lines: { orderBy: { description: "asc" } },
      },
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: rows.map(serializeInvoice),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getAdvertiserCpaInvoiceForAdvertiser(
  invoiceId: string,
  advertiserId: string,
): Promise<SerializedAdvertiserCpaInvoice | null> {
  const row = await prisma.advertiserCpaInvoice.findFirst({
    where: { id: invoiceId, advertiserId },
    include: {
      advertiser: { select: { name: true } },
      lines: { orderBy: { description: "asc" } },
    },
  });
  return row ? serializeInvoice(row) : null;
}

export async function payAdvertiserCpaInvoice(
  invoiceId: string,
  input: { method: PayoutMethod; reference?: string | null; note?: string | null },
): Promise<SerializedAdvertiserCpaInvoice> {
  const existing = await prisma.advertiserCpaInvoice.findUnique({
    where: { id: invoiceId },
  });
  if (!existing) throw Errors.notFound("Invoice");
  if (existing.status === "PAID") throw Errors.validation("Invoice is already paid");
  if (existing.status === "CANCELLED") throw Errors.validation("Invoice is cancelled");

  const row = await prisma.advertiserCpaInvoice.update({
    where: { id: invoiceId },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paymentMethod: input.method,
      paymentReference: input.reference?.trim() || null,
      adminNote: input.note?.trim() || existing.adminNote,
    },
    include: {
      advertiser: { select: { name: true } },
      lines: { orderBy: { description: "asc" } },
    },
  });

  return serializeInvoice(row);
}

export async function cancelAdvertiserCpaInvoice(
  invoiceId: string,
  reason?: string | null,
): Promise<SerializedAdvertiserCpaInvoice> {
  const existing = await prisma.advertiserCpaInvoice.findUnique({
    where: { id: invoiceId },
  });
  if (!existing) throw Errors.notFound("Invoice");
  if (existing.status === "PAID") throw Errors.validation("Paid invoices cannot be cancelled");
  if (existing.status === "CANCELLED") throw Errors.validation("Invoice is already cancelled");

  const row = await prisma.$transaction(async (tx) => {
    await tx.cpaOfferConversion.updateMany({
      where: { advertiserInvoiceId: invoiceId },
      data: { advertiserInvoiceId: null },
    });
    return tx.advertiserCpaInvoice.update({
      where: { id: invoiceId },
      data: {
        status: "CANCELLED",
        periodKey: null,
        cancelReason: reason?.trim() || null,
      },
      include: {
        advertiser: { select: { name: true } },
        lines: { orderBy: { description: "asc" } },
      },
    });
  });

  return serializeInvoice(row);
}

/** Pure helper for tests: billable total from conversion revenues. */
export function sumAdvertiserCpaInvoiceAmount(
  revenues: number[],
): number {
  return round4(revenues.reduce((sum, n) => sum + n, 0));
}

export { moneyToString as advertiserCpaInvoiceMoneyToString };
