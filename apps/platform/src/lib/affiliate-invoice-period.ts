import { format, subDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { resolveUserTimezone } from "@/lib/user-timezone";

/**
 * Monday 00:00 of the week containing `date`, as a real instant.
 *
 * Calendar arithmetic happens on the timezone's wall clock and is only
 * converted back at the end, so DST transitions cannot shift the boundary.
 */
export function invoiceWeekStart(date: Date, timezone: string): Date {
  const tz = resolveUserTimezone(timezone);
  const wall = toZonedTime(date, tz);
  const isoDayOfWeek = Number(format(wall, "i")); // 1 = Monday .. 7 = Sunday
  const monday = subDays(wall, isoDayOfWeek - 1);
  return fromZonedTime(`${format(monday, "yyyy-MM-dd")}T00:00:00`, tz);
}

export type InvoicePeriodBounds = {
  /** Exclusive upper bound for earnings: start of the current week's Monday. */
  periodEndExclusive: Date;
  /** Inclusive end stored on the invoice: the preceding Sunday, 23:59:59.999. */
  periodEnd: Date;
};

/**
 * The most recently completed Monday-to-Sunday week relative to `runAt`.
 *
 * Run on a Monday this is the week that just ended; run mid-week it is still
 * that same week, so a late or repeated run never bills an unfinished week.
 */
export function resolveInvoicePeriod(runAt: Date, timezone: string): InvoicePeriodBounds {
  const periodEndExclusive = invoiceWeekStart(runAt, timezone);
  return {
    periodEndExclusive,
    periodEnd: new Date(periodEndExclusive.getTime() - 1),
  };
}

export function formatInvoicePeriod(
  periodStart: Date | string,
  periodEnd: Date | string,
  timezone: string,
): string {
  const start = periodStart instanceof Date ? periodStart : new Date(periodStart);
  const end = periodEnd instanceof Date ? periodEnd : new Date(periodEnd);
  const tz = resolveUserTimezone(timezone);
  const startLabel = format(toZonedTime(start, tz), "MMM d, yyyy");
  const endLabel = format(toZonedTime(end, tz), "MMM d, yyyy");
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}
