import { formatInTimeZone } from "date-fns-tz";

export const DEFAULT_TIMEZONE = "UTC";

/** Curated IANA zones for settings UI (values must be valid IANA IDs). */
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "Eastern Time (US) — America/New_York" },
  { value: "America/Chicago", label: "Central Time (US) — America/Chicago" },
  { value: "America/Denver", label: "Mountain Time (US) — America/Denver" },
  { value: "America/Los_Angeles", label: "Pacific Time (US) — America/Los_Angeles" },
  { value: "America/Toronto", label: "Toronto — America/Toronto" },
  { value: "America/Sao_Paulo", label: "São Paulo — America/Sao_Paulo" },
  { value: "Europe/London", label: "London — Europe/London" },
  { value: "Europe/Paris", label: "Paris — Europe/Paris" },
  { value: "Europe/Berlin", label: "Berlin — Europe/Berlin" },
  { value: "Europe/Moscow", label: "Moscow — Europe/Moscow" },
  { value: "Asia/Dubai", label: "Dubai — Asia/Dubai" },
  { value: "Asia/Kolkata", label: "India — Asia/Kolkata" },
  { value: "Asia/Singapore", label: "Singapore — Asia/Singapore" },
  { value: "Asia/Shanghai", label: "Shanghai — Asia/Shanghai" },
  { value: "Asia/Tokyo", label: "Tokyo — Asia/Tokyo" },
  { value: "Asia/Jakarta", label: "Jakarta — Asia/Jakarta" },
  { value: "Asia/Bangkok", label: "Bangkok — Asia/Bangkok" },
  { value: "Australia/Sydney", label: "Sydney — Australia/Sydney" },
  { value: "Pacific/Auckland", label: "Auckland — Pacific/Auckland" },
  { value: "Africa/Johannesburg", label: "Johannesburg — Africa/Johannesburg" },
];

const OPTION_VALUES = new Set(TIMEZONE_OPTIONS.map((o) => o.value));

export function isValidTimezone(tz: string | null | undefined): boolean {
  if (!tz || typeof tz !== "string") return false;
  const value = tz.trim();
  if (!value) return false;
  if (OPTION_VALUES.has(value)) return true;
  try {
    // Throws RangeError for invalid IANA zones in modern runtimes
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function resolveUserTimezone(timezone?: string | null): string {
  if (timezone && isValidTimezone(timezone)) return timezone.trim();
  return DEFAULT_TIMEZONE;
}

export function formatUserDateTime(
  date: Date | string | number | null | undefined,
  timezone: string | null | undefined,
  pattern = "MMM d, yyyy HH:mm:ss",
): string {
  if (date == null || date === "") return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const tz = resolveUserTimezone(timezone);
  try {
    return formatInTimeZone(d, tz, pattern);
  } catch {
    return formatInTimeZone(d, DEFAULT_TIMEZONE, pattern);
  }
}
