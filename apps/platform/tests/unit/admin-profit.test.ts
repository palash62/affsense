import { describe, it, expect, vi, beforeEach } from "vitest";
import { REFERRAL_LEVEL_1_RATE, REFERRAL_LEVEL_2_RATE } from "@/lib/referral";

const mockQueryRaw = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

import {
  getAdminProfitForRange,
  splitPlatformProfit,
  formatProfitPeriodLabel,
  formatProfitDateDisplay,
} from "@/services/admin-profit.service";

function sqlText(callArgs: unknown[]): string {
  const first = callArgs[0];
  if (first && typeof first === "object" && "strings" in (first as object)) {
    return (first as { strings: string[] }).strings.join("?");
  }
  if (Array.isArray(first)) {
    return first.join("?");
  }
  return String(first ?? "");
}

describe("Admin Profit Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates admin profit as advertiser payment minus publisher and referral payouts", async () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2026-01-31T23:59:59.999Z");

    mockQueryRaw
      .mockResolvedValueOnce([{ total: 1000 }])
      .mockResolvedValueOnce([{ total: 400 }])
      .mockResolvedValueOnce([{ total: 20 }]);

    const result = await getAdminProfitForRange(from, to);

    expect(result.advertiserPayment).toBe(1000);
    expect(result.publisherPayout).toBe(400);
    expect(result.referralPay).toBe(20);
    expect(result.adminProfit).toBe(1000 - 400 - 20);
    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
  });

  it("uses snapshotted lead CPL (COALESCE) and payment ledger created_at for advertiser payments", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ total: 53.88 }])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{ total: 0 }]);

    await getAdminProfitForRange(new Date(), new Date());

    const advertiserSql = sqlText(mockQueryRaw.mock.calls[0] ?? []);
    expect(advertiserSql).toMatch(/COALESCE\s*\(\s*l\.cpl\s*,\s*c\.cpl\s*\)/i);
    expect(advertiserSql).toMatch(/le\.created_at/i);
    expect(advertiserSql).toMatch(/reference_type = 'lead'/i);
    expect(advertiserSql).toMatch(/type = 'DEBIT'/i);
    expect(advertiserSql).not.toMatch(/l\.updated_at/i);
    expect(advertiserSql).not.toMatch(/SUM\(\s*c\.cpl\s*\)/i);
  });

  it("nets lead_reversal debits out of publisher and referral ledger totals", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ total: 100 }])
      .mockResolvedValueOnce([{ total: 70 }])
      .mockResolvedValueOnce([{ total: 15 }]);

    const result = await getAdminProfitForRange(new Date(), new Date());

    expect(result.publisherPayout).toBe(70);
    expect(result.referralPay).toBe(15);

    const publisherSql = sqlText(mockQueryRaw.mock.calls[1] ?? []);
    const referralSql = sqlText(mockQueryRaw.mock.calls[2] ?? []);

    expect(publisherSql).toMatch(/lead_reversal/i);
    expect(publisherSql).toMatch(/THEN -le\.amount/i);
    expect(publisherSql).toMatch(/role = 'PUBLISHER'/i);
    expect(publisherSql).toMatch(/reference_type = 'lead'/i);

    expect(referralSql).toMatch(/lead_reversal/i);
    expect(referralSql).toMatch(/THEN -le\.amount/i);
    expect(referralSql).toMatch(/reference_type = 'referral'/i);
  });

  it("uses actual referral ledger credits for referral pay", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ total: 500 }])
      .mockResolvedValueOnce([{ total: 150 }])
      .mockResolvedValueOnce([
        { total: 100 * REFERRAL_LEVEL_1_RATE + 100 * REFERRAL_LEVEL_2_RATE },
      ]);

    const result = await getAdminProfitForRange(new Date(), new Date());

    expect(result.referralPay).toBe(15);
    expect(result.adminProfit).toBe(500 - 150 - 15);
  });

  it("queries publisher lead earnings (not withdrawals) with reversal netting", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{ total: 0 }]);

    await getAdminProfitForRange(new Date(), new Date());

    const publisherSql = sqlText(mockQueryRaw.mock.calls[1] ?? []);
    expect(publisherSql).toMatch(/PUBLISHER/);
    expect(publisherSql).toMatch(/lead/);
    expect(publisherSql).not.toMatch(/withdrawal/i);
  });

  it("splits platform profit 80% admin / 20% partner", () => {
    const split = splitPlatformProfit(580);
    expect(split.platformProfit).toBe(580);
    expect(split.adminProfit).toBe(464);
    expect(split.partnerProfit).toBe(116);
    expect(split.adminProfit + split.partnerProfit).toBe(split.platformProfit);
  });

  it("keeps admin and partner shares totaling platform profit for fractional amounts", () => {
    const split = splitPlatformProfit(100.33);
    expect(split.adminProfit + split.partnerProfit).toBe(split.platformProfit);
    expect(split.adminProfit).toBeCloseTo(100.33 * 0.8, 4);
  });

  it("formats period labels as dd-mm-yyyy for day grouping", () => {
    expect(formatProfitPeriodLabel("2026-07-24", "day")).toBe("24-07-2026");
    expect(formatProfitPeriodLabel("2026-07", "month")).toBe("07-2026");
    expect(formatProfitPeriodLabel("2026", "year")).toBe("2026");
    expect(formatProfitDateDisplay("2026-07-24")).toBe("24-07-2026");
  });
});
