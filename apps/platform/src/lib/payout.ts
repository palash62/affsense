export function formatPayoutMethod(method: string) {
  switch (method) {
    case "WISE":
      return "Wise";
    case "STRIPE_CONNECT":
      return "Stripe";
    case "BANK_TRANSFER":
      return "Bank Transfer";
    case "PAYPAL":
      return "PayPal (legacy)";
    default:
      return method.toLowerCase().replace(/_/g, " ");
  }
}

export function formatPayoutKind(kind: string | undefined) {
  switch (kind) {
    case "PUBLISHER":
      return "Publisher";
    case "REFERRAL":
      return "Referral";
    case "CPA":
      return "CPA";
    default:
      return kind ? kind.toLowerCase().replace(/_/g, " ") : "—";
  }
}

export function formatPublisherOptionLabel(publisher: {
  name: string;
  email: string;
  publisherProfile?: { website: string | null } | null;
}) {
  const website = publisher.publisherProfile?.website?.trim();
  if (website) {
    return `${publisher.name} · ${website}`;
  }
  return `${publisher.name} · ${publisher.email}`;
}

function decimalToNumber(value: { toString(): string } | number | string | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

export type AdminPayoutRow = {
  id: string;
  kind?: string;
  amount: number;
  method: string;
  status: string;
  paymentDetails?: unknown;
  rejectionReason?: string | null;
  rejectedAt?: string | null;
  processedAt?: string | null;
  createdAt: string;
  publisher: {
    name: string;
    email: string;
    wallet?: { balance: number; holdBalance: number; currency: string } | null;
    cpaWallet?: { balance: number; holdBalance: number; currency: string } | null;
    publisherProfile?: {
      website?: string | null;
      country?: string | null;
      city?: string | null;
      state?: string | null;
      kycStatus: string;
    } | null;
  };
};

export function serializePayoutForClient(row: {
  id: string;
  kind?: string;
  amount: unknown;
  method: string;
  status: string;
  paymentDetails?: unknown;
  rejectionReason?: string | null;
  rejectedAt?: Date | null;
  processedAt?: Date | null;
  createdAt: Date;
  publisher: {
    name: string;
    email: string;
    wallet?: { balance: unknown; holdBalance: unknown; currency: string } | null;
    cpaWallet?: { balance: unknown; holdBalance: unknown; currency: string } | null;
    publisherProfile?: {
      website?: string | null;
      country?: string | null;
      city?: string | null;
      state?: string | null;
      kycStatus: string;
    } | null;
  };
}): AdminPayoutRow {
  return {
    id: row.id,
    kind: row.kind,
    amount: decimalToNumber(row.amount as { toString(): string }),
    method: row.method,
    status: row.status,
    paymentDetails: row.paymentDetails ?? null,
    rejectionReason: row.rejectionReason,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    processedAt: row.processedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    publisher: {
      name: row.publisher.name,
      email: row.publisher.email,
      wallet: row.publisher.wallet
        ? {
            balance: decimalToNumber(row.publisher.wallet.balance as { toString(): string }),
            holdBalance: decimalToNumber(
              row.publisher.wallet.holdBalance as { toString(): string },
            ),
            currency: row.publisher.wallet.currency,
          }
        : null,
      cpaWallet: row.publisher.cpaWallet
        ? {
            balance: decimalToNumber(row.publisher.cpaWallet.balance as { toString(): string }),
            holdBalance: decimalToNumber(
              row.publisher.cpaWallet.holdBalance as { toString(): string },
            ),
            currency: row.publisher.cpaWallet.currency,
          }
        : null,
      publisherProfile: row.publisher.publisherProfile ?? null,
    },
  };
}

const payoutPublisherSelect = {
  name: true,
  email: true,
  wallet: { select: { balance: true, holdBalance: true, currency: true } },
  publisherProfile: {
    select: {
      website: true,
      country: true,
      city: true,
      state: true,
      kycStatus: true,
    },
  },
} as const;

const payoutCpaPublisherSelect = {
  ...payoutPublisherSelect,
  cpaWallet: { select: { balance: true, holdBalance: true, currency: true } },
} as const;

export { payoutPublisherSelect, payoutCpaPublisherSelect };
