import { describe, expect, it } from 'vitest';
import { activeSeason, activeSpecials, localNow, openStatus, specialsOn } from './schedule';
import type { Closure, Season, Special, WeeklyHours } from './types';

const TZ = 'America/Santo_Domingo'; // UTC−4 all year, no DST

/** A UTC instant from a Bávaro wall-clock time. */
const bavaro = (date: string, time: string) => new Date(`${date}T${time}:00-04:00`);

const daily = (open: string, close: string): WeeklyHours => Array.from({ length: 7 }, () => [{ open, close }]);

describe('localNow', () => {
  it('reads the wall clock in Bávaro, not the server', () => {
    expect(localNow(new Date('2026-10-21T03:30:00Z'), TZ)).toEqual({ date: '2026-10-20', weekday: 2, minutes: 23 * 60 + 30 });
  });
});

describe('openStatus', () => {
  const hours = daily('08:00', '24:00');

  it('is open during the day and says when it closes', () => {
    expect(openStatus(bavaro('2026-10-20', '13:15'), hours, [], TZ)).toEqual({
      open: true,
      closesAt: { date: '2026-10-21', time: '00:00' },
    });
  });

  it('is closed before opening and says when it opens', () => {
    expect(openStatus(bavaro('2026-10-20', '07:59'), hours, [], TZ)).toEqual({
      open: false,
      opensAt: { date: '2026-10-20', time: '08:00' },
    });
  });

  it('treats the closing minute as closed and points at tomorrow', () => {
    expect(openStatus(bavaro('2026-10-21', '00:00'), hours, [], TZ)).toEqual({
      open: false,
      opensAt: { date: '2026-10-21', time: '08:00' },
    });
  });

  it('keeps a range that runs past midnight open into the next day', () => {
    const late = daily('18:00', '02:00');
    expect(openStatus(bavaro('2026-10-21', '01:30'), late, [], TZ)).toEqual({
      open: true,
      closesAt: { date: '2026-10-21', time: '02:00' },
    });
  });

  it('merges back-to-back ranges so it does not announce a false closing', () => {
    const split: WeeklyHours = Array.from({ length: 7 }, () => [
      { open: '08:00', close: '15:00' },
      { open: '15:00', close: '23:00' },
    ]);
    expect(openStatus(bavaro('2026-10-20', '14:00'), split, [], TZ)).toEqual({
      open: true,
      closesAt: { date: '2026-10-20', time: '23:00' },
    });
  });

  it('honours a closure that replaces a day, and skips to the next open day', () => {
    const closures: Closure[] = [{ date: '2026-12-25', ranges: [], reason: 'Christmas' }];
    expect(openStatus(bavaro('2026-12-25', '12:00'), hours, closures, TZ)).toEqual({
      open: false,
      opensAt: { date: '2026-12-26', time: '08:00' },
    });
  });

  it('honours a closure with short hours', () => {
    const closures: Closure[] = [{ date: '2026-12-31', ranges: [{ open: '08:00', close: '18:00' }] }];
    expect(openStatus(bavaro('2026-12-31', '17:00'), hours, closures, TZ)).toEqual({
      open: true,
      closesAt: { date: '2026-12-31', time: '18:00' },
    });
  });

  it('handles a weekday with no hours at all', () => {
    const closedMonday = daily('08:00', '24:00');
    closedMonday[1] = [];
    expect(openStatus(bavaro('2026-10-19', '12:00'), closedMonday, [], TZ)).toEqual({
      open: false,
      opensAt: { date: '2026-10-20', time: '08:00' },
    });
  });

  it('reports no opening at all when every day is closed', () => {
    expect(openStatus(bavaro('2026-10-19', '12:00'), daily('08:00', '08:00').map(() => []), [], TZ)).toEqual({ open: false });
  });
});

const special = (overrides: Partial<Special> & Pick<Special, 'id'>): Special => ({
  title: { en: overrides.id },
  days: [],
  start: '00:00',
  end: '24:00',
  active: true,
  ...overrides,
});

describe('specials', () => {
  const tacoTuesday = special({ id: 'taco-tuesday', days: [2] });
  const happyHour = special({ id: 'happy-hour', start: '17:00', end: '21:00' });
  const rumReggae = special({ id: 'rum-reggae', days: [0], start: '18:00', end: '22:00' });
  const lateSaturday = special({ id: 'late-sat', days: [6], start: '22:00', end: '02:00' });
  const paused = special({ id: 'paused', active: false });
  const xmas = special({ id: 'xmas', validFrom: '2026-12-01', validTo: '2026-12-31' });
  const all = [tacoTuesday, happyHour, rumReggae, lateSaturday, paused, xmas];

  it('lists what runs right now', () => {
    expect(activeSpecials(bavaro('2026-10-20', '18:00'), all, TZ).map((s) => s.id)).toEqual(['taco-tuesday', 'happy-hour']);
    expect(activeSpecials(bavaro('2026-10-20', '21:00'), all, TZ).map((s) => s.id)).toEqual(['taco-tuesday']);
  });

  it('keeps an overnight special running into the next morning, by its starting day', () => {
    expect(activeSpecials(bavaro('2026-10-25', '01:00'), all, TZ).map((s) => s.id)).toEqual(['late-sat']);
    expect(activeSpecials(bavaro('2026-10-24', '01:00'), all, TZ).map((s) => s.id)).toEqual([]);
  });

  it('respects date bounds', () => {
    expect(activeSpecials(bavaro('2026-12-24', '10:00'), all, TZ).map((s) => s.id)).toEqual(['xmas']);
    expect(activeSpecials(bavaro('2027-01-01', '10:00'), all, TZ).map((s) => s.id)).toEqual([]);
  });

  it('lists the line-up for a given day', () => {
    expect(specialsOn('2026-10-25', all).map((s) => s.id)).toEqual(['happy-hour', 'rum-reggae']);
    expect(specialsOn('2026-10-24', all).map((s) => s.id)).toEqual(['happy-hour', 'late-sat']);
  });
});

describe('activeSeason', () => {
  const season = (slug: string, startsOn: string, endsOn: string, priority = 0, published = true): Season => ({
    slug,
    startsOn,
    endsOn,
    priority,
    published,
  });
  const seasons = [
    season('dia-de-muertos', '2026-10-25', '2026-11-03'),
    season('navidad', '2026-12-01', '2027-01-06'),
    season('big-game', '2026-12-20', '2026-12-20', 10),
    season('draft', '2026-10-01', '2026-12-31', 99, false),
  ];

  it('picks the published season covering today', () => {
    expect(activeSeason(bavaro('2026-11-01', '20:00'), seasons, TZ)?.slug).toBe('dia-de-muertos');
    expect(activeSeason(bavaro('2026-11-03', '23:59'), seasons, TZ)?.slug).toBe('dia-de-muertos');
    expect(activeSeason(bavaro('2026-11-04', '00:00'), seasons, TZ)).toBeUndefined();
  });

  it('lets a higher priority win, and ignores drafts', () => {
    expect(activeSeason(bavaro('2026-12-20', '12:00'), seasons, TZ)?.slug).toBe('big-game');
    expect(activeSeason(bavaro('2026-12-21', '12:00'), seasons, TZ)?.slug).toBe('navidad');
  });

  it('prefers the most recently started season at equal priority', () => {
    const overlap = [season('a', '2026-12-01', '2026-12-31'), season('b', '2026-12-10', '2026-12-31')];
    expect(activeSeason(bavaro('2026-12-15', '12:00'), overlap, TZ)?.slug).toBe('b');
  });
});

describe('daypart', () => {
  it('splits the day the way the hero changes', async () => {
    const { daypart } = await import('./schedule');
    expect(daypart(bavaro('2026-10-20', '08:00'), TZ)).toBe('morning');
    expect(daypart(bavaro('2026-10-20', '11:00'), TZ)).toBe('midday');
    expect(daypart(bavaro('2026-10-20', '17:00'), TZ)).toBe('sunset');
    expect(daypart(bavaro('2026-10-20', '19:30'), TZ)).toBe('night');
    expect(daypart(bavaro('2026-10-21', '02:00'), TZ)).toBe('night');
    expect(daypart(bavaro('2026-10-21', '05:00'), TZ)).toBe('morning');
  });
});

describe('orderSlots', () => {
  const hours = daily('08:00', '24:00');
  it('offers today’s pickup times from the lead time until half an hour before closing', async () => {
    const { orderSlots } = await import('./schedule');
    const slots = orderSlots(bavaro('2026-10-20', '21:50'), hours, [], TZ);
    expect(slots).toEqual(['22:45', '23:00', '23:15', '23:30']);
  });
  it('starts at opening when it is still early, and is empty after the last slot', async () => {
    const { orderSlots } = await import('./schedule');
    expect(orderSlots(bavaro('2026-10-20', '06:00'), hours, [], TZ)[0]).toBe('08:00');
    expect(orderSlots(bavaro('2026-10-20', '23:20'), hours, [], TZ)).toEqual([]);
  });
  it('honours closures', async () => {
    const { orderSlots } = await import('./schedule');
    expect(orderSlots(bavaro('2026-12-25', '10:00'), hours, [{ date: '2026-12-25', ranges: [] }], TZ)).toEqual([]);
  });
});

describe('occurrences', () => {
  it('lists the coming dates of a weekly night, within its validity', async () => {
    const { occurrences } = await import('./schedule');
    const s = { id: 'tt', title: { en: 'Taco Tuesday' }, days: [2], start: '08:00', end: '24:00', active: true };
    expect(occurrences(s, '2026-10-18', 14)).toEqual(['2026-10-20', '2026-10-27']);
    expect(occurrences({ ...s, validTo: '2026-10-25' }, '2026-10-18', 14)).toEqual(['2026-10-20']);
    expect(occurrences({ ...s, active: false }, '2026-10-18', 14)).toEqual([]);
  });
});
