/**
 * Points helpers for the Offer Wall. Kept free of Node built-ins so client
 * components can import them.
 */

export function clampOfferWallPointsRatio(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(1_000_000, Math.floor(n));
}

/** Points shown for a dollar payout. Returns null when points display is off. */
export function offerWallPayoutPoints(amount: number, ratio: number): number | null {
  const safeRatio = clampOfferWallPointsRatio(ratio);
  if (safeRatio <= 0) return null;
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * safeRatio);
}

export function formatOfferWallPoints(points: number): string {
  return `${points.toLocaleString()} pts`;
}
