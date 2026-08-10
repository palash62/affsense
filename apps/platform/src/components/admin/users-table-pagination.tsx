"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function UsersTablePagination({
  page,
  totalPages,
  total,
}: {
  page: number;
  totalPages: number;
  total: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function pageHref(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    return `${pathname}?${params.toString()}`;
  }

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <div className="flex items-center justify-between border-t border-border px-6 py-4">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages} · {total} result{total === 1 ? "" : "s"}
      </p>
      <div className="flex gap-2">
        {prevDisabled ? (
          <Button size="sm" variant="outline" disabled>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
        ) : (
          <Link
            href={pageHref(page - 1)}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border bg-background px-2.5 text-sm hover:bg-muted",
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Link>
        )}
        {nextDisabled ? (
          <Button size="sm" variant="outline" disabled>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Link
            href={pageHref(page + 1)}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border bg-background px-2.5 text-sm hover:bg-muted",
            )}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
