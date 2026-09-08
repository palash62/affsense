import type { DepositMethod } from "@prisma/client";

export function formatDepositMethod(method: DepositMethod | string) {
  if (method === "WISE") return "Wise";
  if (method === "CREDIT_CARD") return "Credit Card";
  if (method === "MANUAL") return "Manual (Admin)";
  return String(method);
}

export function formatAdvertiserOptionLabel(advertiser: {
  name: string;
  email: string;
  advertiserProfile?: { company: string } | null;
}) {
  const company = advertiser.advertiserProfile?.company?.trim();
  const name = advertiser.name.trim();
  const headline = company || name;
  if (headline.toLowerCase() === name.toLowerCase()) {
    return `${headline} · ${advertiser.email}`;
  }
  return `${headline} (${name}) · ${advertiser.email}`;
}
