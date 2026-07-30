import { formatUserDateTime } from "@/lib/user-timezone";
import { formatAdvertiserLeadCpl } from "@/lib/advertiser-lead-details";
import { getLeadCpl } from "@/lib/lead-cpl";
import {
  extractLeadCountry,
  formatLeadIp,
  formatLeadRejectReason,
  parseUserAgent,
} from "@/lib/publisher-leads";
import { formatLeadSaleLabel } from "@/lib/cpa-lead-metrics";

export type LeadCsvRow = {
  id: string;
  createdAt: Date;
  cpl?: number | string | { toString(): string } | null;
  campaign: {
    name: string;
    cpl: number | { toString(): string };
    advertiser?: { name: string } | null;
  };
  publisher: { name: string; email: string };
  data: unknown;
  status: string;
  isTest?: boolean;
  country: string | null;
  geoCountry: string | null;
  ip?: string | null;
  submissionMeta?: unknown;
  source: string | null;
  subId: string | null;
  userAgent: string | null;
  riskScore: number | null;
  validationResults: Array<{ passed: boolean; rule: string; details: string | null }>;
  statusHistory: Array<{ reason: string | null; toStatus: string }>;
  salesCount?: number;
  revenue?: number;
};

function escapeCsv(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function leadDataRecord(data: unknown): Record<string, string> {
  if (!data || typeof data !== "object") return {};
  return Object.fromEntries(
    Object.entries(data as Record<string, string>).filter(([, v]) => typeof v === "string"),
  );
}

export function leadsToCsv(
  leads: LeadCsvRow[],
  options: { includeAdvertiser?: boolean; timezone?: string } = {},
) {
  const dataKeys = new Set<string>();
  for (const lead of leads) {
    for (const key of Object.keys(leadDataRecord(lead.data))) {
      dataKeys.add(key);
    }
  }
  const sortedDataKeys = [...dataKeys].sort();

  const baseHeaders = [
    "lead_id",
    "created_at",
    ...(options.includeAdvertiser ? ["advertiser"] : []),
    "campaign",
    "publisher_name",
    ...(options.includeAdvertiser ? ["publisher_email"] : []),
    ...sortedDataKeys,
    "country",
    "ip",
    "source",
    "sub_id",
    "device",
    "os",
    "cpl",
    "sales",
    "revenue",
    "risk_score",
    "status",
    "is_test",
    "notes",
    ...(options.includeAdvertiser ? ["validation_flags"] : []),
  ];

  const rows = leads.map((lead) => {
    const data = leadDataRecord(lead.data);
    const { device, os } = parseUserAgent(lead.userAgent);
    const country = extractLeadCountry(lead.data, lead.country, lead.geoCountry, lead.submissionMeta);
    const ip = formatLeadIp(lead.ip);
    const cpl = formatAdvertiserLeadCpl(lead.status, getLeadCpl(lead), Boolean(lead.isTest));
    const notes = formatLeadRejectReason(lead);
    const flags = lead.validationResults
      .filter((r) => !r.passed)
      .map((r) => r.rule)
      .join("; ");

    const values = [
      lead.id,
      formatUserDateTime(lead.createdAt, options.timezone, "yyyy-MM-dd HH:mm:ss"),
      ...(options.includeAdvertiser ? [lead.campaign.advertiser?.name ?? ""] : []),
      lead.campaign.name,
      lead.publisher.name,
      ...(options.includeAdvertiser ? [lead.publisher.email] : []),
      ...sortedDataKeys.map((key) => data[key]?.trim() ?? ""),
      country === "—" ? "" : country,
      ip === "—" ? "" : ip,
      lead.source ?? "",
      lead.subId ?? "",
      device === "—" ? "" : device,
      os === "—" ? "" : os,
      cpl === "—" ? "" : cpl,
      formatLeadSaleLabel(lead.salesCount ?? 0) === "—"
        ? "0"
        : String(lead.salesCount ?? 0),
      (lead.revenue ?? 0) > 0 ? (lead.revenue ?? 0).toFixed(2) : "0",
      lead.riskScore?.toString() ?? "",
      lead.status,
      lead.isTest ? "true" : "false",
      notes === "—" ? "" : notes,
      ...(options.includeAdvertiser ? [flags] : []),
    ];

    return values.map((v) => escapeCsv(v)).join(",");
  });

  return [baseHeaders.join(","), ...rows].join("\r\n");
}
