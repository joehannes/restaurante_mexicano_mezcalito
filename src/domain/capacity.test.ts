import { describe, expect, it } from 'vitest';
import { availability, canBook, type Booking, type ReservationRules } from './capacity';

const TZ = 'America/Santo_Domingo';
const bavaro = (date: string, time: string) => new Date(`${date}T${time}:00-04:00`);

const rules: ReservationRules = {
  slotMinutes: 30,
  seatingMinutes: 90,
  capacity: 20,
  maxParty: 10,
  minLeadMinutes: 60,
  maxDaysAhead: 30,
  // Every day: seatings 18:00 … 21:00.
  windows: Array.from({ length: 7 }, () => [{ open: '18:00', close: '21:00' }]),
  overrides: [],
};

const NOW = bavaro('2026-10-20', '12:00');
const booking = (time: string, party: number, status: Booking['status'] = 'confirmed', date = '2026-10-21'): Booking => ({
  date,
  time,
  party,
  status,
});

describe('availability', () => {
  it('offers every seating in the window, last seating included', () => {
    const slots = availability('2026-10-21', 2, NOW, rules, [], TZ);
    expect(slots.map((s) => s.time)).toEqual(['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']);
    expect(slots.every((s) => s.bookable && s.remaining === 20)).toBe(true);
  });

  it('holds a table for the whole seating, not just its start slot', () => {
    const slots = availability('2026-10-21', 4, NOW, rules, [booking('19:00', 18)], TZ);
    const byTime = Object.fromEntries(slots.map((s) => [s.time, s]));
    // 19:00–20:30 has 18 covers seated, so a party of 4 cannot start
    // anywhere its own 90 minutes would overlap that.
    expect(byTime['17:30']).toBeUndefined();
    expect(byTime['18:00']?.bookable).toBe(false);
    expect(byTime['18:30']?.bookable).toBe(false);
    expect(byTime['19:00']?.bookable).toBe(false);
    expect(byTime['20:00']?.bookable).toBe(false);
    expect(byTime['20:30']?.bookable).toBe(true);
    expect(byTime['18:00']?.remaining).toBe(2);
  });

  it('ignores cancelled and no-show bookings and bookings on other days', () => {
    const slots = availability(
      '2026-10-21',
      10,
      NOW,
      rules,
      [booking('19:00', 18, 'cancelled'), booking('19:00', 18, 'no_show'), booking('19:00', 18, 'confirmed', '2026-10-22')],
      TZ,
    );
    expect(slots.every((s) => s.bookable)).toBe(true);
  });

  it('applies the lead time on the same day', () => {
    const slots = availability('2026-10-20', 2, bavaro('2026-10-20', '18:10'), rules, [], TZ);
    expect(slots.filter((s) => s.bookable).map((s) => s.time)).toEqual(['19:30', '20:00', '20:30', '21:00']);
  });

  it('offers nothing for past days, days too far ahead, oversized parties or closed days', () => {
    expect(availability('2026-10-19', 2, NOW, rules, [], TZ).some((s) => s.bookable)).toBe(false);
    expect(availability('2026-11-20', 2, NOW, rules, [], TZ).some((s) => s.bookable)).toBe(false);
    expect(availability('2026-10-21', 11, NOW, rules, [], TZ).some((s) => s.bookable)).toBe(false);
    const closed = { ...rules, overrides: [{ date: '2026-10-21', closed: true }] };
    expect(availability('2026-10-21', 2, NOW, closed, [], TZ)).toEqual([]);
  });

  it('lets an event night change capacity and windows', () => {
    const eventNight = {
      ...rules,
      overrides: [{ date: '2026-10-31', capacity: 60, windows: [{ open: '20:00', close: '22:00' }] }],
    };
    const slots = availability('2026-10-31', 10, NOW, eventNight, [booking('20:00', 50, 'confirmed', '2026-10-31')], TZ);
    expect(slots.map((s) => [s.time, s.remaining])).toEqual([
      ['20:00', 10],
      ['20:30', 10],
      ['21:00', 10],
      ['21:30', 60],
      ['22:00', 60],
    ]);
  });
});

describe('canBook', () => {
  it('accepts a free slot and explains a refusal', () => {
    expect(canBook('2026-10-21', '19:00', 4, NOW, rules, [], TZ)).toEqual({ ok: true });
    expect(canBook('2026-10-21', '19:15', 4, NOW, rules, [], TZ)).toEqual({ ok: false, reason: 'not_a_slot' });
    expect(canBook('2026-10-21', '19:00', 0, NOW, rules, [], TZ)).toEqual({ ok: false, reason: 'party_size' });
    expect(canBook('2026-10-21', '19:00', 11, NOW, rules, [], TZ)).toEqual({ ok: false, reason: 'party_size' });
    expect(canBook('2026-10-20', '12:30', 2, NOW, rules, [], TZ)).toEqual({ ok: false, reason: 'not_a_slot' });
    expect(canBook('2026-10-20', '18:00', 2, bavaro('2026-10-20', '17:30'), rules, [], TZ)).toEqual({ ok: false, reason: 'too_soon' });
    expect(canBook('2026-11-30', '19:00', 2, NOW, rules, [], TZ)).toEqual({ ok: false, reason: 'too_far' });
    expect(canBook('2026-10-21', '19:00', 4, NOW, rules, [booking('18:30', 18)], TZ)).toEqual({ ok: false, reason: 'full' });
    const closed = { ...rules, overrides: [{ date: '2026-10-21', closed: true }] };
    expect(canBook('2026-10-21', '19:00', 2, NOW, closed, [], TZ)).toEqual({ ok: false, reason: 'closed' });
  });
});
