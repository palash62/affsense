import { describe, expect, it } from "vitest";
import { buildReportOrderBy, nextReportSort, sortRows } from "@/lib/report-sort";

type Row = { id: string; amount: number | null; name: string | null; at: string };

const rows: Row[] = [
  { id: "a", amount: 5, name: "beta", at: "2026-10-02T00:00:00.000Z" },
  { id: "b", amount: null, name: "Alpha", at: "2026-10-03T00:00:00.000Z" },
  { id: "c", amount: 12, name: null, at: "2026-10-01T00:00:00.000Z" },
];

const accessors = {
  amount: (row: Row) => row.amount,
  name: (row: Row) => row.name,
  date: (row: Row) => row.at,
};

describe("sortRows", () => {
  it("sorts numbers ascending and descending with empty values last", () => {
    expect(sortRows(rows, { sortBy: "amount", sortDir: "asc" }, accessors).map((r) => r.id)).toEqual(["a", "c", "b"]);
    expect(sortRows(rows, { sortBy: "amount", sortDir: "desc" }, accessors).map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("compares text case-insensitively", () => {
    expect(sortRows(rows, { sortBy: "name", sortDir: "asc" }, accessors).map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts ISO dates", () => {
    expect(sortRows(rows, { sortBy: "date", sortDir: "asc" }, accessors).map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("leaves the order alone for unknown or missing columns", () => {
    expect(sortRows(rows, { sortBy: "nope", sortDir: "asc" }, accessors)).toBe(rows);
    expect(sortRows(rows, {}, accessors)).toBe(rows);
  });
});

describe("nextReportSort", () => {
  it("starts a new column descending and flips the active one", () => {
    expect(nextReportSort(null, "amount")).toEqual({ by: "amount", dir: "desc" });
    expect(nextReportSort({ by: "amount", dir: "desc" }, "amount")).toEqual({ by: "amount", dir: "asc" });
    expect(nextReportSort({ by: "amount", dir: "asc" }, "amount")).toEqual({ by: "amount", dir: "desc" });
    expect(nextReportSort({ by: "amount", dir: "asc" }, "date")).toEqual({ by: "date", dir: "desc" });
  });
});

describe("buildReportOrderBy", () => {
  type OrderBy = { payout?: string; createdAt?: string; id?: string };
  const columns: Record<string, (dir: "asc" | "desc") => OrderBy> = { payout: (dir) => ({ payout: dir }) };
  const tie = (dir: "asc" | "desc"): OrderBy => ({ id: dir });

  it("uses the whitelisted column with an id tie-breaker", () => {
    expect(buildReportOrderBy({ sortBy: "payout", sortDir: "asc" }, columns, { createdAt: "desc" }, tie)).toEqual([
      { payout: "asc" },
      { id: "asc" },
    ]);
  });

  it("falls back to newest first for unknown columns", () => {
    expect(buildReportOrderBy({ sortBy: "password", sortDir: "asc" }, columns, { createdAt: "desc" }, tie)).toEqual([
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });
});
