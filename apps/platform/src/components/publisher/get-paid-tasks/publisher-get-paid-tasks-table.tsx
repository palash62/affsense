"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SubmissionStatusPill,
} from "@/components/admin/get-paid-tasks/get-paid-task-table-cells";
import type { PublisherTaskListItem } from "@/services/publisher-task-submission.service";

function ctaLabel(task: PublisherTaskListItem) {
  if (!task.submission) return "Start";
  if (task.submission.status === "PENDING") return "View";
  if (task.submission.status === "APPROVED") return "Completed";
  return "Try again";
}

export function PublisherGetPaidTasksTable({
  tasks,
  onOpen,
}: {
  tasks: PublisherTaskListItem[];
  onOpen: (task: PublisherTaskListItem) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="h-10 min-w-[200px] px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Task
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Category
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Action
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reward
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Proof
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your Status
              </TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const disabled = task.submission?.status === "APPROVED";
              return (
                <TableRow key={task.id} className="border-border hover:bg-muted/80">
                  <TableCell className="px-4 py-3">
                    <p className="font-medium text-foreground">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.taskType}</p>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                    {task.category}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                    {task.requiredAction}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm font-semibold text-[var(--theme-success)]">
                    ${task.rewardAmount.toFixed(2)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                    {task.proofRequired ? "Yes" : "No"}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {task.submission ? (
                      <SubmissionStatusPill status={task.submission.status} />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      disabled={disabled}
                      onClick={() => onOpen(task)}
                      className="h-8 rounded-md bg-[var(--theme-primary)] hover:opacity-90"
                    >
                      {ctaLabel(task)}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
