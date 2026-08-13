import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaskFlags, TaskStatusPill } from "./get-paid-task-table-cells";
import type { GetPaidTaskListItem } from "./get-paid-task-list-utils";

export function GetPaidTasksTable({ tasks }: { tasks: GetPaidTaskListItem[] }) {
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
                Status
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Flags
              </TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
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
                <TableCell className="px-4 py-3 text-sm font-semibold text-foreground">
                  ${task.rewardAmount.toFixed(2)}
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                  {task.proofRequired ? "Yes" : "No"}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <TaskStatusPill status={task.status} />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <TaskFlags
                    proofRequired={task.proofRequired}
                    featured={task.featured}
                    isNew={task.isNew}
                  />
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <Link
                    href="/admin/get-paid-tasks/new"
                    className="text-sm font-medium text-[var(--theme-primary)] hover:underline"
                  >
                    Manage
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
