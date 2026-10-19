// "Today" and daily buckets are computed in the campus timezone rather than
// the server's (UTC on Vercel), so the dashboard matches what admins expect.
export const DASHBOARD_TIME_ZONE = "America/New_York";

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: DASHBOARD_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: DASHBOARD_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** YYYY-MM-DD for the given instant, in the dashboard timezone. */
export function dayKey(date: Date): string {
  return dayKeyFormat.format(date);
}

/** Milliseconds the dashboard timezone is ahead of UTC at the given instant. */
function zoneOffsetMs(date: Date): number {
  const p = Object.fromEntries(
    partsFormat.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - (date.getTime() - date.getMilliseconds());
}

/** The UTC instant of local midnight starting the given YYYY-MM-DD. */
export function startOfDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  // Re-check the offset at the computed instant to handle DST transitions.
  const first = new Date(guess.getTime() - zoneOffsetMs(guess));
  return new Date(guess.getTime() - zoneOffsetMs(first));
}

/** The last `count` day keys ending with today, oldest first. */
export function lastDayKeys(now: Date, count: number): string[] {
  const todayKey = dayKey(now);
  const [y, m, d] = todayKey.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    // Noon UTC avoids any date rollover when formatting.
    const date = new Date(Date.UTC(y, m - 1, d - (count - 1 - i), 12));
    return date.toISOString().slice(0, 10);
  });
}
