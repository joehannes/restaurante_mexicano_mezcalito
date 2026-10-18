/**
 * Table bookings against seated capacity.
 *
 * D1 has no interactive transactions, so a booking is checked, inserted, and
 * then checked again against every booking that was inserted before it. When
 * two guests race for the last table, the later row sees the earlier one and
 * withdraws itself — the earlier booking always wins, nobody is double-booked.
 */
import { availability, canBook, type Booking, type BookingCheck, type ReservationRules } from '../domain/capacity';
import { reservationCode, type ReservationInput } from '../domain/reservationInput';
import { tellKitchen } from './orders';

export async function loadRules(db: D1Database): Promise<ReservationRules> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'reservations'").first<{ value: string }>();
  return JSON.parse(row!.value) as ReservationRules;
}

async function bookingsOn(db: D1Database, date: string) {
  const { results } = await db
    .prepare('SELECT id, date, time, party, status FROM reservations WHERE date = ?')
    .bind(date)
    .all<Booking & { id: number }>();
  return results;
}

export async function slotsFor(env: Env, date: string, party: number, now = new Date()) {
  const [rules, bookings] = await Promise.all([loadRules(env.DB), bookingsOn(env.DB, date)]);
  return { slots: availability(date, party, now, rules, bookings, env.TIMEZONE), maxParty: rules.maxParty };
}

export type BookResult =
  | { ok: true; code: string; seatingMinutes: number }
  | { ok: false; reason: Exclude<BookingCheck, { ok: true }>['reason'] | 'storage' };

export async function book(env: Env, input: ReservationInput, now = new Date()): Promise<BookResult> {
  const rules = await loadRules(env.DB);
  const before = await bookingsOn(env.DB, input.date);
  const first = canBook(input.date, input.time, input.party, now, rules, before, env.TIMEZONE);
  if (!first.ok) return first;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = reservationCode();
    let id: number;
    try {
      const row = await env.DB.prepare(
        `INSERT INTO reservations (code, date, time, party, status, name, phone, email, occasion, seating, addons, notes, locale)
         VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
        .bind(
          code,
          input.date,
          input.time,
          input.party,
          input.name,
          input.phone,
          input.email ?? null,
          input.occasion,
          input.seating,
          JSON.stringify(input.addons),
          input.notes ?? null,
          input.locale,
        )
        .first<{ id: number }>();
      id = row!.id;
    } catch (error) {
      if (String(error).includes('UNIQUE')) continue;
      console.error('reservation storage failed', error);
      return { ok: false, reason: 'storage' };
    }

    // Re-check against everything booked before this row.
    const earlier = (await bookingsOn(env.DB, input.date)).filter((b) => b.id < id);
    const second = canBook(input.date, input.time, input.party, now, rules, earlier, env.TIMEZONE);
    if (!second.ok) {
      await env.DB.prepare('DELETE FROM reservations WHERE id = ?').bind(id).run();
      return { ok: false, reason: 'full' };
    }

    await tellKitchen(env, 'board', { type: 'reservation.created', code, date: input.date, time: input.time, party: input.party });
    return { ok: true, code, seatingMinutes: rules.seatingMinutes };
  }
  return { ok: false, reason: 'storage' };
}
