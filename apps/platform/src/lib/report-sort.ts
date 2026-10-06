import { z } from "zod";

export type SortDir = "asc" | "desc";

export type ReportSort = { by: string; dir: SortDir };

/** Query fields shared by report list endpoints. */
export const reportSortQueryFields = {
  sortBy: z.string().trim().max(40).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
};

export type ReportSortQuery = { sortBy?: string; sortDir?: SortDir };

/** A new column starts descending; clicking the active column flips it. */
export function nextReportSort(current: ReportSort | null, column: string): ReportSort {
  if (current?.by === column) return { by: column, dir: current.dir === "desc" ? "asc" : "desc" };
  return { by: column, dir: "desc" };
}

export function setReportSortParams(params: URLSearchParams, sort: ReportSort | null) {
  if (!sort) return;
  params.set("sortBy", sort.by);
  params.set("sortDir", sort.dir);
}

type SortValue = string | number | Date | null | undefined;

function normalize(value: SortValue): string | number | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.getTime();
  return typeof value === "string" ? value.toLowerCase() : value;
}

/**
 * Sort rows in memory. Unknown columns leave the order as is; empty values always
 * go last so the interesting rows stay on the first page.
 */
export function sortRows<T>(
  rows: T[],
  sort: ReportSortQuery,
  accessors: Record<string, (row: T) => SortValue>,
): T[] {
  const accessor = sort.sortBy ? accessors[sort.sortBy] : undefined;
  if (!accessor) return rows;
  const factor = sort.sortDir === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: normalize(accessor(row)) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) {
        if (a.value === b.value) return a.index - b.index;
        return a.value === null ? 1 : -1;
      }
      if (a.value < b.value) return -1 * factor;
      if (a.value > b.value) return 1 * factor;
      return a.index - b.index;
    })
    .map((entry) => entry.row);
}

/**
 * Prisma orderBy for a whitelisted column, newest first otherwise. `id` breaks ties
 * so pages stay stable.
 */
export function buildReportOrderBy<TOrderBy>(
  sort: ReportSortQuery,
  columns: Record<string, (dir: SortDir) => TOrderBy>,
  fallback: TOrderBy,
  tieBreaker: (dir: SortDir) => TOrderBy,
): TOrderBy[] {
  const build = sort.sortBy ? columns[sort.sortBy] : undefined;
  if (!build) return [fallback, tieBreaker("desc")];
  const dir = sort.sortDir ?? "desc";
  return [build(dir), tieBreaker(dir)];
}
