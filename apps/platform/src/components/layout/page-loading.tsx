import { Skeleton } from "@/components/ui/skeleton";

export function PageLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-24 w-full rounded-[var(--radius-card,0.875rem)]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-[var(--radius-card,0.875rem)]" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-[var(--radius-card,0.875rem)]" />
    </div>
  );
}
