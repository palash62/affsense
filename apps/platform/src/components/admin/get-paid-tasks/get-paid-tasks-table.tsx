import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { TaskFlags, TaskStatusPill } from "./get-paid-task-table-cells";
import type { GetPaidTaskListItem } from "./get-paid-task-list-utils";

export function GetPaidTasksTable({
  tasks,
  onDelete,
}: {
  tasks: GetPaidTaskListItem[];
  onDelete: (id: string) => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmTask = tasks.find((t) => t.id === confirmId);
  return (
    <>
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
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href="/admin/get-paid-tasks/new"
                      className="text-sm font-medium text-[var(--theme-primary)] hover:underline"
                    >
                      Manage
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmId(task.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>

      <AlertDialog open={!!confirmId} onOpenChange={(open) => { if (!open) setConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{confirmTask?.title}&rdquo; will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmId) onDelete(confirmId);
                setConfirmId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
