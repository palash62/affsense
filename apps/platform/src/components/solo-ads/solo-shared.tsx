import { cn } from "@/lib/utils";

export function formatUsdCents(cents: number | null | undefined) {
  const value = (cents ?? 0) / 100;
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatSoloDateTime(at: Date | string) {
  return `${new Date(at).toLocaleString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })} UTC`;
}

export function soloPct(part: number, total: number) {
  return total > 0 ? `${((part / total) * 100).toFixed(1)}%` : "—";
}

export function soloCsvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = typeof value !== "number" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_REVIEW: "bg-amber-50 text-amber-700",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  PAUSED: "bg-slate-100 text-slate-700",
  BUDGET_EXHAUSTED: "bg-orange-50 text-orange-700",
  INSUFFICIENT_FUNDS: "bg-red-50 text-red-700",
  COMPLETED: "bg-indigo-50 text-indigo-700",
  REJECTED: "bg-red-50 text-red-700",
  DISABLED: "bg-red-50 text-red-700",
  REVOKED: "bg-red-50 text-red-700",
  PENDING: "bg-amber-50 text-amber-700",
  BILLED: "bg-emerald-50 text-emerald-700",
  INVALID: "bg-red-50 text-red-700",
  REFUNDED: "bg-indigo-50 text-indigo-700",
  FALLBACK: "bg-slate-100 text-slate-700",
  SUCCEEDED: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-red-50 text-red-700",
  DISPUTED: "bg-red-50 text-red-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REVERSED: "bg-red-50 text-red-700",
};

export function soloStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function SoloStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700",
        className,
      )}
    >
      {soloStatusLabel(status)}
    </span>
  );
}

export const ADMIN_SOLO_NAV = [
  { href: "/admin/solo-ads", label: "Overview", exact: true },
  { href: "/admin/solo-ads/campaigns", label: "Campaigns" },
  { href: "/admin/solo-ads/providers", label: "Providers" },
  { href: "/admin/solo-ads/wallets", label: "Wallets" },
  { href: "/admin/solo-ads/fraud", label: "Traffic quality" },
  { href: "/admin/solo-ads/settings", label: "Settings" },
];

export const PUBLISHER_SOLO_NAV = [
  { href: "/publisher/solo-ads", label: "Overview", exact: true },
  { href: "/publisher/solo-ads/campaigns", label: "Campaigns" },
  { href: "/publisher/solo-ads/providers", label: "Provider performance" },
  { href: "/publisher/solo-ads/reports", label: "Reports" },
  { href: "/publisher/solo-ads/wallet", label: "Wallet" },
  { href: "/publisher/solo-ads/tracking", label: "Tracking setup" },
];

export const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15";

export const TEXTAREA_CLASS =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15";
