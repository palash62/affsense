export const SUPPORT_CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "General",
  BILLING: "Billing",
  TECHNICAL: "Technical",
  CAMPAIGN: "Campaign",
  PAYOUT: "Payout",
  OTHER: "Other",
};

export const SUPPORT_STATUS_STYLES: Record<string, string> = {
  OPEN: "border-blue-200 bg-blue-50 text-blue-700",
  IN_PROGRESS: "border-amber-200 bg-amber-50 text-amber-700",
  WAITING_ON_CUSTOMER: "border-violet-200 bg-violet-50 text-violet-700",
  RESOLVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CLOSED: "border-border bg-muted text-muted-foreground",
};

export const SUPPORT_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_ON_CUSTOMER: "Waiting on you",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export function formatTicketStatus(status: string) {
  return SUPPORT_STATUS_LABELS[status] ?? status.replace(/_/g, " ").toLowerCase();
}

export function truncateTicketMessage(text: string, max = 80) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}
