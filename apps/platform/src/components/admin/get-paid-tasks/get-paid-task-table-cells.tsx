import { cn } from "@/lib/utils";
import type { GetPaidTaskListItem } from "./get-paid-task-list-utils";
import type { PublisherTaskSubmissionSummary } from "@/services/publisher-task-submission.service";

export function TaskStatusPill({ status }: { status: GetPaidTaskListItem["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "Active" &&
          "bg-[color-mix(in_srgb,var(--theme-success)_14%,white)] text-[var(--theme-success)]",
        status === "Draft" &&
          "bg-[color-mix(in_srgb,var(--warning)_16%,white)] text-[var(--warning)]",
        status === "Paused" && "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

export function SubmissionStatusPill({
  status,
}: {
  status: PublisherTaskSubmissionSummary["status"];
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "PENDING" &&
          "bg-[color-mix(in_srgb,var(--warning)_16%,white)] text-[var(--warning)]",
        status === "APPROVED" &&
          "bg-[color-mix(in_srgb,var(--theme-success)_14%,white)] text-[var(--theme-success)]",
        status === "REJECTED" && "bg-destructive/10 text-destructive",
      )}
    >
      {status === "PENDING" ? "Pending review" : status === "APPROVED" ? "Approved" : "Rejected"}
    </span>
  );
}

export function TaskFlags({
  proofRequired,
  featured,
  isNew,
}: {
  proofRequired: boolean;
  featured: boolean;
  isNew: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <span
        className={cn(
          "rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
          proofRequired
            ? "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
            : "bg-muted text-muted-foreground",
        )}
      >
        {proofRequired ? "Proof" : "No proof"}
      </span>
      {featured ? (
        <span className="rounded-md bg-[color-mix(in_srgb,var(--warning)_14%,white)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--warning)]">
          Featured
        </span>
      ) : null}
      {isNew ? (
        <span className="rounded-md bg-[color-mix(in_srgb,var(--theme-accent-purple,#713BFF)_12%,white)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--theme-accent-purple,#713BFF)]">
          New
        </span>
      ) : null}
    </div>
  );
}
