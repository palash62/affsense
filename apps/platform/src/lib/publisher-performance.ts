export const PERFORMANCE_SOURCES = ["all", "cpa", "digital"] as const;
export type PerformanceSource = (typeof PERFORMANCE_SOURCES)[number];

export function parsePerformanceSource(value: string | null | undefined): PerformanceSource {
  return PERFORMANCE_SOURCES.includes(value as PerformanceSource) ? (value as PerformanceSource) : "all";
}

export type PerformanceTotals = { clicks: number; conversions: number; earnings: number };
export type PerformanceRow = PerformanceTotals & { cr: number; epc: number };

/** CR is a percentage of clicks; both ratios are 0 when there are no clicks. */
export function withPerformanceRatios<T extends PerformanceTotals>(row: T): T & { cr: number; epc: number } {
  const earnings = Math.round(row.earnings * 100) / 100;
  if (row.clicks <= 0) return { ...row, earnings, cr: 0, epc: 0 };
  return {
    ...row,
    earnings,
    cr: Math.round((row.conversions / row.clicks) * 10000) / 100,
    epc: Math.round((row.earnings / row.clicks) * 100) / 100,
  };
}
