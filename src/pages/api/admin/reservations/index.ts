import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { availability, type Booking } from '../../../../domain/capacity';
import { localNow } from '../../../../domain/schedule';
import { guard, json } from '../../../../server/admin';
import { loadRules } from '../../../../server/reservations';
import { reservationsOn } from '../../../../server/staffData';

/** One day's bookings, with the covers still free at each seating. */
export const GET: APIRoute = async ({ locals, url }) => {
  const staff = guard(locals, 'reservations');
  if (staff instanceof Response) return staff;
  const date = url.searchParams.get('date') ?? localNow(new Date(), env.TIMEZONE).date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'invalid', fields: ['date'] }, 400);
  const [bookings, rules] = await Promise.all([reservationsOn(env.DB, date), loadRules(env.DB)]);
  // Seatings as a party of one sees them: the room's free covers at each time.
  const slots = availability(date, 1, new Date(0), { ...rules, minLeadMinutes: 0, maxDaysAhead: 100_000 }, bookings as Booking[], env.TIMEZONE);
  return json({ date, bookings, slots, rules });
};
