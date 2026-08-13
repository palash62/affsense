"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ListTodo, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { GetPaidTaskCard } from "./get-paid-task-card";
import { GetPaidTasksFilters } from "./get-paid-tasks-filters";
import { filterGetPaidTasks, type GetPaidTaskListItem } from "./get-paid-task-list-utils";

function GetPaidTasksListInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [tasks, setTasks] = useState<GetPaidTaskListItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/admin/get-paid-tasks?limit=200")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setTasks(json.data?.items ?? []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load tasks");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filters = useMemo(
    () => ({
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      category: searchParams.get("category") ?? undefined,
    }),
    [searchParams],
  );

  const filtered = useMemo(() => filterGetPaidTasks(tasks, filters), [tasks, filters]);
  const total = tasks.length;
  const shown = filtered.length;
  const hasFilters = Boolean(filters.q || filters.status || filters.category);

  return (
    <div className="space-y-5">
      <GetPaidTasksFilters />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {hasFilters
            ? `Showing ${shown} of ${total} task${total === 1 ? "" : "s"}`
            : `${total} task${total === 1 ? "" : "s"}`}
        </p>
        <ButtonLink
          href="/admin/get-paid-tasks/new"
          className="h-10 gap-2 rounded-md bg-[var(--theme-primary)] px-4 shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add New Task
        </ButtonLink>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-card,0.875rem)] border border-dashed border-border bg-card px-6 py-16 text-center shadow-[var(--shadow-card)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--theme-primary-soft)]">
            <ListTodo className="h-6 w-6 text-[var(--theme-primary)]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {hasFilters ? "No tasks match your filters" : "No get paid tasks yet"}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {hasFilters
              ? "Try adjusting search or filters to see more tasks."
              : "Create your first task for members to complete and earn."}
          </p>
          {hasFilters ? (
            <Button
              type="button"
              variant="outline"
              className="mt-5 h-9 rounded-md"
              onClick={() => router.push(pathname)}
            >
              Clear filters
            </Button>
          ) : (
            <ButtonLink
              href="/admin/get-paid-tasks/new"
              className="mt-5 h-9 gap-2 rounded-md bg-[var(--theme-primary)] px-4 hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add New Task
            </ButtonLink>
          )}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((task) => (
            <GetPaidTaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

export function GetPaidTasksList() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <div className="h-14 animate-pulse rounded-[var(--radius-card,0.875rem)] bg-muted" />
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-[var(--radius-card,0.875rem)] bg-muted"
              />
            ))}
          </div>
        </div>
      }
    >
      <GetPaidTasksListInner />
    </Suspense>
  );
}
