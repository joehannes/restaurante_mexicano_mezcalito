/**
 * When a marketing event shows: which one is featured today, and how to
 * describe where today falls against its dates. Dates are YYYY-MM-DD in
 * Bávaro time.
 */

export interface Dated {
  published: boolean;
  startsOn: string;
  endsOn: string;
  priority: number;
}

const DAY = 86_400_000;
const days = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

/**
 * The event to feature: one running today wins (highest priority, then the
 * one ending soonest), else the next one starting within `lookAheadDays`.
 */
export function currentEvent<T extends Dated>(events: readonly T[], today: string, lookAheadDays = 21): T | undefined {
  const live = events
    .filter((e) => e.published && e.startsOn <= today && e.endsOn >= today)
    .sort((a, b) => b.priority - a.priority || a.endsOn.localeCompare(b.endsOn));
  if (live[0]) return live[0];
  return events
    .filter((e) => e.published && e.startsOn > today && days(today, e.startsOn) <= lookAheadDays)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || b.priority - a.priority)[0];
}

export type EventTiming = { state: 'live'; lastDay: boolean } | { state: 'soon'; days: number } | { state: 'over' };

/** Where `today` falls against the event's dates. */
export function eventTiming(e: Pick<Dated, 'startsOn' | 'endsOn'>, today: string): EventTiming {
  if (today > e.endsOn) return { state: 'over' };
  if (today >= e.startsOn) return { state: 'live', lastDay: today === e.endsOn && e.startsOn !== e.endsOn };
  return { state: 'soon', days: days(today, e.startsOn) };
}
