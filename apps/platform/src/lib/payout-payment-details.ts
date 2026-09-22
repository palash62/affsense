import type { PayoutMethod } from "@prisma/client";
import { getCountryName } from "@/lib/campaign-form";

export type EmailPayoutDetails = {
  email: string;
};

export type BankPayoutDetails = {
  country: string;
  beneficiaryName: string;
  accountNumber: string;
  accountType?: "checking" | "savings";
  routingNumber?: string;
  sortCode?: string;
  iban?: string;
  swiftBic?: string;
  bankName?: string;
  bankAddress?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

export type PayoutPaymentDetails = EmailPayoutDetails | BankPayoutDetails;

export function isBankPayoutDetails(
  details: unknown,
  method: PayoutMethod | string,
): details is BankPayoutDetails {
  return (
    method === "BANK_TRANSFER" &&
    !!details &&
    typeof details === "object" &&
    "beneficiaryName" in details
  );
}

export function isEmailPayoutDetails(
  details: unknown,
  method: PayoutMethod | string,
): details is EmailPayoutDetails {
  return (
    (method === "WISE" || method === "STRIPE_CONNECT" || method === "PAYPAL") &&
    !!details &&
    typeof details === "object" &&
    "email" in details
  );
}

export function formatPayoutMethodLabel(method: string) {
  switch (method) {
    case "WISE":
      return "Wise";
    case "STRIPE_CONNECT":
      return "Stripe";
    case "BANK_TRANSFER":
      return "Bank Transfer";
    case "PAYPAL":
      return "PayPal";
    default:
      return method.toLowerCase().replace(/_/g, " ");
  }
}

export function payoutDetailsSummary(
  method: string,
  details: unknown,
): string {
  if (!details || typeof details !== "object") return "—";
  const d = details as Record<string, unknown>;

  if (method === "WISE" || method === "STRIPE_CONNECT" || method === "PAYPAL") {
    return typeof d.email === "string" ? d.email : "—";
  }

  if (method === "BANK_TRANSFER") {
    const name = typeof d.beneficiaryName === "string" ? d.beneficiaryName : "";
    const country = typeof d.country === "string" ? getCountryName(d.country) : "";
    if (name && country) return `${name} · ${country}`;
    return name || country || "—";
  }

  return "—";
}

export type PublisherPayeeSnapshot = {
  method: "WISE" | "BANK_TRANSFER";
  details: EmailPayoutDetails | BankPayoutDetails;
};

/** Resolve default pay-to from publisher profile for invoice snapshot. */
export function resolvePublisherPayeeSnapshot(profile: {
  defaultPayoutMethod?: string | null;
  payoutWiseId?: string | null;
  payoutBankDetails?: unknown;
} | null | undefined): PublisherPayeeSnapshot | null {
  if (!profile?.defaultPayoutMethod) return null;
  if (profile.defaultPayoutMethod === "WISE") {
    const id = profile.payoutWiseId?.trim();
    if (!id) return null;
    return { method: "WISE", details: { email: id } };
  }
  if (profile.defaultPayoutMethod === "BANK_TRANSFER") {
    if (!isBankPayoutDetails(profile.payoutBankDetails, "BANK_TRANSFER")) return null;
    return { method: "BANK_TRANSFER", details: profile.payoutBankDetails };
  }
  return null;
}

export function bankPayoutDetailRows(details: BankPayoutDetails): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: "Country", value: getCountryName(details.country) },
    { label: "Beneficiary name", value: details.beneficiaryName },
    { label: "Account number", value: details.accountNumber },
  ];

  if (details.accountType) rows.push({ label: "Account type", value: details.accountType });
  if (details.routingNumber) rows.push({ label: "Routing / IFSC", value: details.routingNumber });
  if (details.sortCode) rows.push({ label: "Sort code", value: details.sortCode });
  if (details.iban) rows.push({ label: "IBAN", value: details.iban });
  if (details.swiftBic) rows.push({ label: "SWIFT / BIC", value: details.swiftBic });
  if (details.bankName) rows.push({ label: "Bank name", value: details.bankName });
  if (details.bankAddress) rows.push({ label: "Bank address", value: details.bankAddress });

  const addressParts = [
    details.addressLine1,
    details.city,
    details.state,
    details.postalCode,
  ].filter(Boolean);

  if (addressParts.length) {
    rows.push({ label: "Beneficiary address", value: addressParts.join(", ") });
  }

  return rows;
}
