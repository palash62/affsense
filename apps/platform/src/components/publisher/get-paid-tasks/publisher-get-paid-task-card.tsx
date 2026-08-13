"use client";

import { Heart, ThumbsUp, PlayCircle, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PublisherTaskListItem } from "@/services/publisher-task-submission.service";

function PreviewIcon({ action }: { action: string }) {
  const a = action.toLowerCase();
  if (a.includes("subscribe") || a.includes("youtube")) {
    return <PlayCircle className="h-5 w-5 text-red-500" />;
  }
  if (a.includes("like") || a.includes("facebook")) {
    return <ThumbsUp className="h-5 w-5 text-blue-600" />;
  }
  if (a.includes("follow") || a.includes("share") || a.includes("instagram")) {
    return <Heart className="h-5 w-5 text-pink-600" />;
  }
  return <MousePointerClick className="h-5 w-5 text-[var(--theme-primary)]" />;
}

function SubmissionPill({ status }: { status: NonNullable<PublisherTaskListItem["submission"]>["status"] }) {
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

function ctaLabel(task: PublisherTaskListItem) {
  if (!task.submission) return "Start";
  if (task.submission.status === "PENDING") return "View";
  if (task.submission.status === "APPROVED") return "Completed";
  return "Try again";
}

export function PublisherGetPaidTaskCard({
  task,
  onOpen,
}: {
  task: PublisherTaskListItem;
  onOpen: (task: PublisherTaskListItem) => void;
}) {
  const disabled = task.submission?.status === "APPROVED";

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-4",
        "shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-md bg-[var(--theme-primary-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--theme-primary)]">
          {task.category}
        </span>
        {task.submission ? <SubmissionPill status={task.submission.status} /> : null}
      </div>

      <div className="mt-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <PreviewIcon action={task.requiredAction || task.taskType} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {task.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {task.taskType} · {task.requiredAction}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-base font-bold text-[var(--theme-success)]">
          ${task.rewardAmount.toFixed(2)}
        </span>
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
            task.proofRequired
              ? "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
              : "bg-muted text-muted-foreground",
          )}
        >
          {task.proofRequired ? "Proof required" : "No proof"}
        </span>
        {task.featured ? (
          <span className="rounded-md bg-[color-mix(in_srgb,var(--warning)_14%,white)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--warning)]">
            Featured
          </span>
        ) : null}
        {task.isNew ? (
          <span className="rounded-md bg-[color-mix(in_srgb,var(--theme-accent-purple,#713BFF)_12%,white)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--theme-accent-purple,#713BFF)]">
            New
          </span>
        ) : null}
      </div>

      <Button
        type="button"
        size="sm"
        disabled={disabled}
        onClick={() => onOpen(task)}
        className="mt-auto h-9 w-full rounded-md bg-[var(--theme-primary)] hover:opacity-90"
      >
        {ctaLabel(task)}
      </Button>
    </article>
  );
}
