import { describe, expect, it } from "vitest";
import { buildReportOrderBy, nextReportSort, sortRows } from "@/lib/report-sort";
import {
  CPA_AFFILIATE_REPORT_SORT_ACCESSORS,
  type SerializedCpaAffiliateOfferReportRow,
} from "@/services/cpa-offer.service";
import {
  DIGITAL_AFFILIATE_REPORT_SORT_ACCESSORS,
  type SerializedDigitalProductAffiliateReportRow,
} from "@/services/digital-product.service";

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

describe("affiliate report accessors", () => {
  const cpaRows = [
    { offerName: "Zeta", subId: null, payout: "9.50", clicks: 40 },
    { offerName: "alpha", subId: "s1", payout: "100.00", clicks: 3 },
    { offerName: "Mid", subId: "s0", payout: "20.25", clicks: 12 },
  ] as unknown as SerializedCpaAffiliateOfferReportRow[];

  it("sorts money strings numerically", () => {
    const sorted = sortRows(cpaRows, { sortBy: "payout", sortDir: "desc" }, CPA_AFFILIATE_REPORT_SORT_ACCESSORS);
    expect(sorted.map((r) => r.payout)).toEqual(["100.00", "20.25", "9.50"]);
  });

  it("sorts offer names and sub IDs with empty values last", () => {
    expect(
      sortRows(cpaRows, { sortBy: "offer", sortDir: "asc" }, CPA_AFFILIATE_REPORT_SORT_ACCESSORS).map((r) => r.offerName),
    ).toEqual(["alpha", "Mid", "Zeta"]);
    expect(
      sortRows(cpaRows, { sortBy: "subId", sortDir: "asc" }, CPA_AFFILIATE_REPORT_SORT_ACCESSORS).map((r) => r.subId),
    ).toEqual(["s0", "s1", null]);
  });

  it("sorts digital commission numerically", () => {
    const digitalRows = [
      { commission: "5.00" },
      { commission: "45.00" },
      { commission: "12.00" },
    ] as unknown as SerializedDigitalProductAffiliateReportRow[];
    expect(
      sortRows(digitalRows, { sortBy: "commission", sortDir: "asc" }, DIGITAL_AFFILIATE_REPORT_SORT_ACCESSORS).map(
        (r) => r.commission,
      ),
    ).toEqual(["5.00", "12.00", "45.00"]);
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
