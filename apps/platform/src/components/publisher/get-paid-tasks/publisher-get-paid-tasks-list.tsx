"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ListTodo } from "lucide-react";
import { toast } from "sonner";
import { PublisherGetPaidTasksFilters } from "./publisher-get-paid-tasks-filters";
import { PublisherGetPaidTaskCard } from "./publisher-get-paid-task-card";
import { PublisherHowItWorksPanel } from "./publisher-how-it-works-panel";
import { PublisherTaskDetailSheet } from "./publisher-task-detail-sheet";
import type { PublisherTaskListItem } from "@/services/publisher-task-submission.service";

function PublisherGetPaidTasksListInner() {
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<PublisherTaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    const category = searchParams.get("category");
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    params.set("limit", "200");
    return params.toString();
  }, [searchParams]);

  const loadTasks = useCallback(() => {
    setLoading(true);
    fetch(`/api/v1/publisher/get-paid-tasks?${queryString}`)
      .then((r) => r.json())
      .then((json) => {
        setTasks(json.data?.items ?? []);
      })
      .catch(() => {
        toast.error("Failed to load tasks");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [queryString]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const categories = useMemo(
    () => [...new Set(tasks.map((t) => t.category))].sort(),
    [tasks],
  );

  const hasFilters = Boolean(searchParams.get("q") || searchParams.get("category"));
  const total = tasks.length;

  function openTask(task: PublisherTaskListItem) {
    setSelectedTaskId(task.id);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <PublisherGetPaidTasksFilters categories={categories} />

          <p className="text-sm text-muted-foreground">
            {hasFilters
              ? `Showing ${total} matching task${total === 1 ? "" : "s"}`
              : `${total} available task${total === 1 ? "" : "s"}`}
          </p>

          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse rounded-[var(--radius-card,0.875rem)] bg-muted"
                />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-card,0.875rem)] border border-dashed border-border bg-card px-6 py-16 text-center shadow-[var(--shadow-card)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--theme-primary-soft)]">
                <ListTodo className="h-6 w-6 text-[var(--theme-primary)]" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                {hasFilters ? "No tasks match your filters" : "No tasks available yet"}
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {hasFilters
                  ? "Try adjusting search or filters."
                  : "Check back soon for new earning opportunities."}
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {tasks.map((task) => (
                <PublisherGetPaidTaskCard key={task.id} task={task} onOpen={openTask} />
              ))}
            </div>
          )}
        </div>

        <div className="xl:col-span-4">
          <PublisherHowItWorksPanel />
        </div>
      </div>

      <PublisherTaskDetailSheet
        taskId={selectedTaskId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSubmitted={loadTasks}
      />
    </div>
  );
}

export function PublisherGetPaidTasksList() {
  return (
    <Suspense
      fallback={
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-[var(--radius-card,0.875rem)] bg-muted"
            />
          ))}
        </div>
      }
    >
      <PublisherGetPaidTasksListInner />
    </Suspense>
  );
}
