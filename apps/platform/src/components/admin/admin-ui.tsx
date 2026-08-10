import type { UserStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { isPendingPayoutStatus, payoutStatusLabel } from "@/lib/payout-status";
import { cn } from "@/lib/utils";

export const avatarColors = [
  "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]",
  "bg-[color-mix(in_srgb,var(--theme-accent-purple,#713BFF)_12%,white)] text-[var(--theme-accent-purple,#713BFF)]",
  "bg-[color-mix(in_srgb,var(--theme-success)_12%,white)] text-[var(--theme-success)]",
  "bg-[color-mix(in_srgb,var(--warning)_14%,white)] text-[var(--warning)]",
  "bg-muted text-muted-foreground",
];

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const styles: Record<UserStatus, string> = {
    ACTIVE: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,white)] text-[var(--success)]",
    SUSPENDED: "border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive",
    PENDING: "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,white)] text-[var(--warning)]",
  };

  return (
    <Badge variant="outline" className={cn("font-medium capitalize", styles[status])}>
      {status === "SUSPENDED" ? "blocked" : status.toLowerCase()}
    </Badge>
  );
}

export function EmailVerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        verified
          ? "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,white)] text-[var(--success)]"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {verified ? "Email verified" : "Email not verified"}
    </Badge>
  );
}

export function LeadStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    CAPTURED: "border-border bg-muted text-muted-foreground",
    VALIDATING: "border-[color-mix(in_srgb,var(--primary)_30%,transparent)] bg-[var(--theme-primary-soft)] text-primary",
    PENDING: "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,white)] text-[var(--warning)]",
    APPROVED: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,white)] text-[var(--success)]",
    REJECTED: "border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive",
    PAID: "border-[color-mix(in_srgb,var(--theme-accent-purple,#713BFF)_30%,transparent)] bg-[color-mix(in_srgb,var(--theme-accent-purple,#713BFF)_10%,white)] text-[var(--theme-accent-purple,#713BFF)]",
  };

  return (
    <Badge variant="outline" className={cn("font-medium capitalize", styles[status] ?? "border-border bg-muted text-muted-foreground")}>
      {status.toLowerCase()}
    </Badge>
  );
}

export function DepositStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,white)] text-[var(--success)]",
    PENDING: "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,white)] text-[var(--warning)]",
    FAILED: "border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive",
  };

  const labels: Record<string, string> = {
    COMPLETED: "approved",
    PENDING: "pending",
    FAILED: "rejected",
  };

  return (
    <Badge variant="outline" className={cn("font-medium capitalize", styles[status] ?? "border-border bg-muted text-muted-foreground")}>
      {labels[status] ?? status.toLowerCase()}
    </Badge>
  );
}

export function CampaignStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,white)] text-[var(--success)]",
    PENDING: "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,white)] text-[var(--warning)]",
    PAUSED: "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,white)] text-[var(--warning)]",
    DRAFT: "border-border bg-muted text-muted-foreground",
    COMPLETED: "border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive",
    ARCHIVED: "border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive",
  };

  const labels: Record<string, string> = {
    COMPLETED: "stopped",
    ARCHIVED: "rejected",
    PAUSED: "paused",
    PENDING: "pending review",
  };

  return (
    <Badge variant="outline" className={cn("font-medium capitalize", styles[status] ?? "border-[color-mix(in_srgb,var(--primary)_30%,transparent)] bg-[var(--theme-primary-soft)] text-primary")}>
      {labels[status] ?? status.toLowerCase()}
    </Badge>
  );
}

export function PayoutStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,white)] text-[var(--success)]",
    PENDING: "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,white)] text-[var(--warning)]",
    REQUESTED: "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,white)] text-[var(--warning)]",
    REJECTED: "border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive",
    PROCESSING: "border-[color-mix(in_srgb,var(--primary)_30%,transparent)] bg-[var(--theme-primary-soft)] text-primary",
    FAILED: "border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive",
  };

  const styleKey = isPendingPayoutStatus(status) ? "PENDING" : status;

  return (
    <Badge variant="outline" className={cn("font-medium capitalize", styles[styleKey] ?? "border-border bg-muted text-muted-foreground")}>
      {payoutStatusLabel(status)}
    </Badge>
  );
}

export function KycStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    APPROVED: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,white)] text-[var(--success)]",
    PENDING: "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,white)] text-[var(--warning)]",
    REJECTED: "border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive",
  };

  return (
    <Badge variant="outline" className={cn("text-xs font-medium capitalize", styles[status] ?? "border-border bg-muted text-muted-foreground")}>
      KYC: {status.toLowerCase()}
    </Badge>
  );
}

export function spamScoreLevel(score: number): "low" | "medium" | "high" {
  if (score > 50) return "high";
  if (score > 20) return "medium";
  return "low";
}

export function SpamScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="text-sm text-muted-foreground">N/A</span>;
  }

  const level = spamScoreLevel(score);
  const styles = {
    low: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,white)] text-[var(--success)]",
    medium: "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,white)] text-[var(--warning)]",
    high: "border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive",
  } as const;

  return (
    <Badge variant="outline" className={cn("font-semibold tabular-nums", styles[level])}>
      {score}
    </Badge>
  );
}

const SPAM_SCORE_GUIDE = [
  { range: "0–20", label: "Low risk", level: "low" as const, action: "Generally safe to approve" },
  { range: "21–50", label: "Review", level: "medium" as const, action: "Check recent leads before approving" },
  { range: "51+", label: "High risk", level: "high" as const, action: "Consider rejecting the publisher" },
];

const spamGuideStyles = {
  low: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,white)] text-[var(--success)]",
  medium: "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,white)] text-[var(--warning)]",
  high: "border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive",
} as const;

export function SpamScoreGuide({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Score guide:</span>
        {SPAM_SCORE_GUIDE.map((item) => (
          <span
            key={item.range}
            className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium", spamGuideStyles[item.level])}
          >
            {item.range} {item.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/80 p-4">
      <p className="text-sm font-semibold text-foreground">Spam score guide</p>
      <p className="mt-1 text-xs text-muted-foreground">
        30-day average lead risk (0 = safe, 100 = risky). Same scale as Fraud Center lead scores.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {SPAM_SCORE_GUIDE.map((item) => (
          <div
            key={item.range}
            className={cn("rounded-lg border px-3 py-2.5", spamGuideStyles[item.level])}
          >
            <p className="text-sm font-bold">{item.range}</p>
            <p className="text-xs font-semibold">{item.label}</p>
            <p className="mt-1 text-[11px] opacity-90">{item.action}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
