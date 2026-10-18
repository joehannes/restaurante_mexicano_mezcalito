/** What a guest may send when booking a table. */
import { normalizePhone } from './orderInput';
import { LOCALES, type Locale } from './types';

export const OCCASIONS = ['none', 'birthday', 'anniversary', 'date', 'group'] as const;
export const SEATING = ['any', 'terrace', 'inside', 'dj'] as const;

export interface ReservationInput {
  locale: Locale;
  date: string;
  time: string;
  party: number;
  name: string;
  phone: string;
  email?: string;
  occasion: (typeof OCCASIONS)[number];
  seating: (typeof SEATING)[number];
  addons: string[];
  notes?: string;
}

export type ReservationField = 'body' | 'date' | 'time' | 'party' | 'name' | 'phone' | 'email';

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function parseReservationInput(
  body: unknown,
): { ok: true; value: ReservationInput } | { ok: false; errors: ReservationField[] } {
  if (!body || typeof body !== 'object') return { ok: false, errors: ['body'] };
  const b = body as Record<string, unknown>;
  const errors: ReservationField[] = [];

  const date = str(b.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) errors.push('date');
  const time = str(b.time, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) errors.push('time');
  const party = typeof b.party === 'number' ? b.party : Number.NaN;
  if (!Number.isInteger(party) || party < 1 || party > 60) errors.push('party');
  const name = str(b.name, 80);
  if (name.length < 2) errors.push('name');
  const phone = normalizePhone(str(b.phone, 30));
  if (!phone) errors.push('phone');
  const email = str(b.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email');
  if (errors.length) return { ok: false, errors };

  const occasion = OCCASIONS.includes(b.occasion as never) ? (b.occasion as ReservationInput['occasion']) : 'none';
  const seating = SEATING.includes(b.seating as never) ? (b.seating as ReservationInput['seating']) : 'any';
  // Sparklers only make sense for a birthday.
  const addons = occasion === 'birthday' && b.sparklers === true ? ['sparklers'] : [];
  return {
    ok: true,
    value: {
      locale: LOCALES.includes(b.locale as Locale) ? (b.locale as Locale) : 'en',
      date,
      time,
      party,
      name,
      phone: phone!,
      email: email || undefined,
      occasion,
      seating,
      addons,
      notes: str(b.notes, 500) || undefined,
    },
  };
}

const CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY3479';
export function reservationCode(random: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return `R-${code}`;
}
