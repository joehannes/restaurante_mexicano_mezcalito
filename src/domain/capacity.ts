/**
 * Table reservations against seated capacity.
 *
 * Mezcalito is one open room and a terrace, not a floor plan of fixed tables,
 * so capacity is counted in covers: how many guests can be seated at once. A
 * booking holds its covers for a whole seating (say 90 minutes), so a party
 * may start at a slot only if every slot its seating overlaps still has room.
 *
 * The server calls `canBook` inside the same D1 batch that inserts the row,
 * so two guests racing for the last table cannot both get it.
 */
import { addDays, localNow, parseClock, weekdayOf } from './schedule';
import type { ClockTime, TimeRange } from './types';

export interface DayOverride {
  /** YYYY-MM-DD */
  date: string;
  closed?: boolean;
  /** Covers for that day, e.g. a bigger event night. */
  capacity?: number;
  /** Seating windows for that day, replacing the weekly ones. */
  windows?: TimeRange[];
}

export interface ReservationRules {
  slotMinutes: number;
  /** How long a booking holds its covers. */
  seatingMinutes: number;
  /** Covers that can be seated at once. */
  capacity: number;
  /** Largest party bookable online; bigger groups go through Parties. */
  maxParty: number;
  minLeadMinutes: number;
  maxDaysAhead: number;
  /**
   * Seating windows per weekday (0 = Sunday). `open` is the first seating and
   * `close` the last one; windows do not cross midnight.
   */
  windows: TimeRange[][];
  overrides: DayOverride[];
}

export type BookingStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';

export interface Booking {
  date: string;
  time: ClockTime;
  party: number;
  status: BookingStatus;
}

export interface Slot {
  time: ClockTime;
  /** Covers still free across the whole seating. */
  remaining: number;
  bookable: boolean;
}

export type BookingCheck =
  | { ok: true }
  | { ok: false; reason: 'closed' | 'party_size' | 'not_a_slot' | 'too_soon' | 'too_far' | 'full' };

const HOLDS_COVERS: ReadonlySet<BookingStatus> = new Set(['pending', 'confirmed', 'seated']);

const clock = (minutes: number): ClockTime =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

function dayPlan(date: string, rules: ReservationRules) {
  const override = rules.overrides.find((o) => o.date === date);
  if (override?.closed) return undefined;
  return {
    capacity: override?.capacity ?? rules.capacity,
    windows: override?.windows ?? rules.windows[weekdayOf(date)] ?? [],
  };
}

function slotTimes(windows: readonly TimeRange[], step: number): number[] {
  const times = new Set<number>();
  for (const w of windows) {
    for (let t = parseClock(w.open); t <= parseClock(w.close); t += step) times.add(t);
  }
  return [...times].sort((a, b) => a - b);
}

/** Covers still free for a seating starting at `start`. */
function freeCovers(start: number, date: string, capacity: number, rules: ReservationRules, bookings: readonly Booking[]) {
  const held = bookings
    .filter((b) => b.date === date && HOLDS_COVERS.has(b.status))
    .map((b) => ({ from: parseClock(b.time), party: b.party }));
  let free = capacity;
  for (let t = start; t < start + rules.seatingMinutes; t += rules.slotMinutes) {
    const seated = held.filter((b) => b.from <= t && t < b.from + rules.seatingMinutes).reduce((n, b) => n + b.party, 0);
    free = Math.min(free, capacity - seated);
  }
  return free;
}

/** Minutes from now until a local date and time (negative if it has passed). */
function minutesUntil(date: string, minutes: number, now: Date, timeZone: string) {
  const local = localNow(now, timeZone);
  const days = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${local.date}T00:00:00Z`)) / 86_400_000;
  return days * 1440 + minutes - local.minutes;
}

const tooFar = (date: string, now: Date, rules: ReservationRules, timeZone: string) =>
  date > addDays(localNow(now, timeZone).date, rules.maxDaysAhead);

export function availability(
  date: string,
  party: number,
  now: Date,
  rules: ReservationRules,
  bookings: readonly Booking[],
  timeZone: string,
): Slot[] {
  const plan = dayPlan(date, rules);
  if (!plan) return [];
  const partyOk = Number.isInteger(party) && party >= 1 && party <= rules.maxParty;
  const far = tooFar(date, now, rules, timeZone);
  return slotTimes(plan.windows, rules.slotMinutes).map((t) => {
    const remaining = freeCovers(t, date, plan.capacity, rules, bookings);
    const bookable =
      partyOk && !far && minutesUntil(date, t, now, timeZone) >= rules.minLeadMinutes && remaining >= party;
    return { time: clock(t), remaining, bookable };
  });
}

export function canBook(
  date: string,
  time: ClockTime,
  party: number,
  now: Date,
  rules: ReservationRules,
  bookings: readonly Booking[],
  timeZone: string,
): BookingCheck {
  const plan = dayPlan(date, rules);
  if (!plan) return { ok: false, reason: 'closed' };
  if (!Number.isInteger(party) || party < 1 || party > rules.maxParty) return { ok: false, reason: 'party_size' };
  const t = parseClock(time);
  if (!slotTimes(plan.windows, rules.slotMinutes).includes(t)) return { ok: false, reason: 'not_a_slot' };
  if (minutesUntil(date, t, now, timeZone) < rules.minLeadMinutes) return { ok: false, reason: 'too_soon' };
  if (tooFar(date, now, rules, timeZone)) return { ok: false, reason: 'too_far' };
  if (freeCovers(t, date, plan.capacity, rules, bookings) < party) return { ok: false, reason: 'full' };
  return { ok: true };
}
