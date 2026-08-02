import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUserFindFirst = vi.fn();
const mockPartnerPaymentCreate = vi.fn();
const mockPartnerPaymentFindMany = vi.fn();
const mockPartnerPaymentGroupBy = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: (...args: unknown[]) => mockUserFindFirst(...args) },
    partnerPayment: {
      create: (...args: unknown[]) => mockPartnerPaymentCreate(...args),
      findMany: (...args: unknown[]) => mockPartnerPaymentFindMany(...args),
      groupBy: (...args: unknown[]) => mockPartnerPaymentGroupBy(...args),
    },
  },
}));

vi.mock("@/services/admin-profit.service", async () => {
  const actual = await vi.importActual<typeof import("@/services/admin-profit.service")>(
    "@/services/admin-profit.service",
  );
  return {
    ...actual,
    getAdminProfitPageData: vi.fn(),
  };
});

import {
  buildPartnerSettlementRows,
  createPartnerPayment,
  isValidPeriodMonth,
  partnerSettlementStatus,
  summarizePartnerSettlement,
} from "@/services/partner-payment.service";

describe("partner payment helpers", () => {
  it("validates YYYY-MM period months", () => {
    expect(isValidPeriodMonth("2026-08")).toBe(true);
    expect(isValidPeriodMonth("2026-13")).toBe(false);
    expect(isValidPeriodMonth("2026-8")).toBe(false);
    expect(isValidPeriodMonth("08-2026")).toBe(false);
  });

  it("builds settlement remaining for unpaid, partial, settled, and overpaid", () => {
    const rows = buildPartnerSettlementRows(
      ["2026-01", "2026-02", "2026-03", "2026-04"],
      new Map([
        ["2026-01", 100],
        ["2026-02", 100],
        ["2026-03", 100],
        ["2026-04", 50],
      ]),
      new Map([
        ["2026-01", 0],
        ["2026-02", 40],
        ["2026-03", 100],
        ["2026-04", 75],
      ]),
    );

    expect(rows[0]).toMatchObject({
      periodMonth: "2026-01",
      owed: 100,
      paid: 0,
      remaining: 100,
      status: "unpaid",
    });
    expect(rows[1]).toMatchObject({
      periodMonth: "2026-02",
      owed: 100,
      paid: 40,
      remaining: 60,
      status: "partial",
    });
    expect(rows[2]).toMatchObject({
      periodMonth: "2026-03",
      owed: 100,
      paid: 100,
      remaining: 0,
      status: "settled",
    });
    expect(rows[3]).toMatchObject({
      periodMonth: "2026-04",
      owed: 50,
      paid: 75,
      remaining: -25,
      status: "overpaid",
    });
  });

  it("summarizes owed/paid/remaining across months", () => {
    const summary = summarizePartnerSettlement([
      {
        periodMonth: "2026-01",
        owed: 100,
        paid: 40,
        remaining: 60,
        status: "partial",
      },
      {
        periodMonth: "2026-02",
        owed: 50,
        paid: 50,
        remaining: 0,
        status: "settled",
      },
    ]);
    expect(summary).toEqual({ owed: 150, paid: 90, remaining: 60 });
  });

  it("maps settlement status edges", () => {
    expect(partnerSettlementStatus(0, 0)).toBe("settled");
    expect(partnerSettlementStatus(10, 0)).toBe("unpaid");
    expect(partnerSettlementStatus(10, 10)).toBe("settled");
    expect(partnerSettlementStatus(10, 12)).toBe("overpaid");
  });
});

describe("createPartnerPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid periodMonth", async () => {
    await expect(
      createPartnerPayment({
        periodMonth: "2026-13",
        amount: 10,
        paidAt: new Date("2026-08-01"),
        adminId: "admin-1",
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining("YYYY-MM") });
  });

  it("rejects non-positive amount", async () => {
    await expect(
      createPartnerPayment({
        periodMonth: "2026-08",
        amount: 0,
        paidAt: new Date("2026-08-01"),
        adminId: "admin-1",
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining("greater than 0") });
  });

  it("creates a payment when admin and inputs are valid", async () => {
    mockUserFindFirst.mockResolvedValue({ id: "admin-1" });
    mockPartnerPaymentCreate.mockResolvedValue({
      id: "pay-1",
      periodMonth: "2026-08",
      amount: { toNumber: () => 25 },
      paidAt: new Date("2026-08-15T00:00:00.000Z"),
      method: "Wise",
      note: "August share",
      createdById: "admin-1",
      createdAt: new Date("2026-08-15T12:00:00.000Z"),
      createdBy: { name: "Admin" },
    });

    const result = await createPartnerPayment({
      periodMonth: "2026-08",
      amount: 25,
      paidAt: new Date("2026-08-15T00:00:00.000Z"),
      method: "Wise",
      note: "August share",
      adminId: "admin-1",
    });

    expect(mockPartnerPaymentCreate).toHaveBeenCalled();
    expect(result).toMatchObject({
      id: "pay-1",
      periodMonth: "2026-08",
      amount: 25,
      method: "Wise",
      note: "August share",
      createdByName: "Admin",
    });
  });
});
