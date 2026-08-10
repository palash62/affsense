import Link from "next/link";
import { cn } from "@/lib/utils";
import type { GetPaidTaskListItem } from "./mock-data";

function StatusPill({ status }: { status: GetPaidTaskListItem["status"] }) {
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

export function GetPaidTaskCard({ task }: { task: GetPaidTaskListItem }) {
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
        <StatusPill status={task.status} />
      </div>

      <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
        {task.title}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {task.taskType} · {task.requiredAction}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-base font-bold text-foreground">
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

      <Link
        href="/admin/get-paid-tasks/new"
        className="mt-auto pt-4 text-sm font-medium text-[var(--theme-primary)] hover:underline"
      >
        Manage task
      </Link>
    </article>
  );
}
