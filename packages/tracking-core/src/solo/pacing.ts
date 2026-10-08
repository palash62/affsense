export type LocalParts = { date: string; hour: number; minute: number };

const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  let fmt = formatterCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(tz, fmt);
  }
  return fmt;
}

/** Calendar date and wall-clock time of `at` in `timeZone`. */
export function localParts(at: Date, timeZone: string): LocalParts {
  const parts = formatterFor(timeZone).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = Number(get("hour")) % 24;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour,
    minute: Number(get("minute")),
  };
}

export function localDate(at: Date, timeZone: string): string {
  return localParts(at, timeZone).date;
}

export function utcDate(at: Date): string {
  return at.toISOString().slice(0, 10);
}

const LOCAL_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** "YYYY-MM-DDTHH:mm" wall-clock time in `timeZone` → UTC instant. */
export function zonedInputToUtc(value: string, timeZone: string): Date | null {
  const m = LOCAL_INPUT_PATTERN.exec(value.trim());
  if (!m) return null;
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  let guess = wall;
  for (let i = 0; i < 2; i += 1) {
    const p = localParts(new Date(guess), timeZone);
    const [y, mo, d] = p.date.split("-").map(Number);
    const shown = Date.UTC(y!, mo! - 1, d!, p.hour, p.minute);
    guess += wall - shown;
  }
  return new Date(guess);
}

/** UTC instant → "YYYY-MM-DDTHH:mm" wall-clock time in `timeZone`. */
export function utcToZonedInput(at: Date, timeZone: string): string {
  const p = localParts(at, timeZone);
  return `${p.date}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/**
 * Routing weight for a campaign. Campaigns behind their even daily pace get
 * more traffic; a small share of remaining budget keeps every campaign moving.
 */
export function pacingWeight(input: {
  dailyBudgetCents: number;
  usedTodayCents: number;
  priority: number;
  at: Date;
  timeZone: string;
}): number {
  const remaining = input.dailyBudgetCents - input.usedTodayCents;
  if (remaining <= 0) return 0;
  const { hour, minute } = localParts(input.at, input.timeZone);
  const elapsed = (hour * 60 + minute + 1) / 1440;
  const deficit = input.dailyBudgetCents * elapsed - input.usedTodayCents;
  const priority = Math.max(1, Math.min(10, Math.round(input.priority || 1)));
  return (Math.max(0, deficit) + remaining * 0.1) * priority;
}

/** Weighted sampling without replacement: an order to try candidates in. */
export function weightedOrder<T>(
  items: Array<{ item: T; weight: number }>,
  random: () => number = Math.random,
): T[] {
  const pool = items.filter((i) => i.weight > 0);
  const out: T[] = [];
  while (pool.length > 0) {
    const total = pool.reduce((sum, i) => sum + i.weight, 0);
    let roll = random() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i += 1) {
      roll -= pool[i]!.weight;
      if (roll < 0) {
        index = i;
        break;
      }
    }
    out.push(pool[index]!.item);
    pool.splice(index, 1);
  }
  return out;
}
