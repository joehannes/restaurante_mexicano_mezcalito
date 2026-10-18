/**
 * What is happening at Mezcalito at a given moment, on Bávaro's clock.
 *
 * The Worker runs in UTC and guests' phones run on whatever zone they flew in
 * from, so every "now" is first turned into a Bávaro wall-clock reading. The
 * Dominican Republic keeps UTC−4 all year, but the zone is looked up through
 * Intl rather than hard-coded, so nothing breaks if that ever changes.
 *
 * Time ranges are "HH:MM"–"HH:MM". A close at or before the open runs past
 * midnight into the next day, and "24:00" is the midnight that ends a day.
 */
import type { ClockTime, Closure, Season, Special, TimeRange, WeeklyHours } from './types';

const DAY = 1440;

export interface LocalNow {
  /** YYYY-MM-DD */
  date: string;
  /** 0 = Sunday */
  weekday: number;
  /** Minutes since local midnight. */
  minutes: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
const formatter = (timeZone: string) => {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, f);
  }
  return f;
};

export function localNow(at: Date, timeZone: string): LocalNow {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(at).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, weekday: weekdayOf(date), minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export const parseClock = (time: ClockTime): number => {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const formatClock = (minutes: number): ClockTime =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;
const dateOf = (day: number) => new Date(day * 86_400_000).toISOString().slice(0, 10);
export const addDays = (date: string, days: number) => dateOf(dayNumber(date) + days);
export const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** [start, end) in minutes from the start of `date`; overnight ranges end past 1440. */
const span = (range: TimeRange): [number, number] => {
  const open = parseClock(range.open);
  let close = parseClock(range.close);
  if (close <= open) close += DAY;
  return [open, close];
};

const rangesOn = (date: string, hours: WeeklyHours, closures: readonly Closure[]): TimeRange[] =>
  closures.find((c) => c.date === date)?.ranges ?? hours[weekdayOf(date)] ?? [];

export type OpenStatus =
  | { open: true; closesAt: { date: string; time: ClockTime } }
  | { open: false; opensAt?: { date: string; time: ClockTime } };

const at = (base: string, minutes: number) => {
  const days = Math.floor(minutes / DAY);
  return { date: addDays(base, days), time: formatClock(minutes - days * DAY) };
};

/** Open now? And until when, or from when — looking a week ahead. */
export function openStatus(now: Date, hours: WeeklyHours, closures: readonly Closure[], timeZone: string): OpenStatus {
  const local = localNow(now, timeZone);

  // Every interval from yesterday (overnight spill) to a week out, on one
  // timeline measured in minutes from today's local midnight.
  const intervals: [number, number][] = [];
  for (let d = -1; d <= 7; d++) {
    for (const range of rangesOn(addDays(local.date, d), hours, closures)) {
      const [s, e] = span(range);
      intervals.push([s + d * DAY, e + d * DAY]);
    }
  }
  intervals.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of intervals) {
    const last = merged.at(-1);
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }

  const t = local.minutes;
  const current = merged.find(([s, e]) => s <= t && t < e);
  if (current) return { open: true, closesAt: at(local.date, current[1]) };
  const next = merged.find(([s]) => s > t);
  return next ? { open: false, opensAt: at(local.date, next[0]) } : { open: false };
}

const runsOn = (special: Special, date: string) =>
  special.active &&
  (!special.validFrom || date >= special.validFrom) &&
  (!special.validTo || date <= special.validTo) &&
  (!special.days.length || special.days.includes(weekdayOf(date)));

/** The line-up for a day: specials that start that day. */
export const specialsOn = (date: string, specials: readonly Special[]) => specials.filter((s) => runsOn(s, date));

/** Specials running at this moment, including overnight ones that began yesterday. */
export function activeSpecials(now: Date, specials: readonly Special[], timeZone: string): Special[] {
  const { date, minutes } = localNow(now, timeZone);
  const yesterday = addDays(date, -1);
  return specials.filter((special) => {
    const [s, e] = span({ open: special.start, close: special.end });
    if (runsOn(special, date) && s <= minutes && minutes < e) return true;
    return e > DAY && runsOn(special, yesterday) && minutes < e - DAY;
  });
}

/** The published season covering today: highest priority, then the latest to start. */
export function activeSeason<T extends Season>(now: Date, seasons: readonly T[], timeZone: string): T | undefined {
  const { date } = localNow(now, timeZone);
  return seasons
    .filter((s) => s.published && s.startsOn <= date && date <= s.endsOn)
    .sort((a, b) => b.priority - a.priority || b.startsOn.localeCompare(a.startsOn))[0];
}
