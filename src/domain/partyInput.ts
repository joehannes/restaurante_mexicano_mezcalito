/** What a guest may send when asking about a party, a big group or catering. */
import { normalizePhone } from './orderInput';
import { LOCALES, type Locale } from './types';

export const PARTY_KINDS = ['birthday', 'group', 'corporate', 'catering', 'other'] as const;
export type PartyKind = (typeof PARTY_KINDS)[number];

export interface PartyInput {
  locale: Locale;
  kind: PartyKind;
  guests: number;
  date: string;
  time?: string;
  name: string;
  phone: string;
  email?: string;
  message?: string;
}

export type PartyField = 'body' | 'guests' | 'date' | 'time' | 'name' | 'phone' | 'email';

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function parsePartyInput(body: unknown): { ok: true; value: PartyInput } | { ok: false; errors: PartyField[] } {
  if (!body || typeof body !== 'object') return { ok: false, errors: ['body'] };
  const b = body as Record<string, unknown>;
  const errors: PartyField[] = [];

  const guests = typeof b.guests === 'number' ? b.guests : Number.NaN;
  if (!Number.isInteger(guests) || guests < 1 || guests > 500) errors.push('guests');
  const date = str(b.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) errors.push('date');
  const time = str(b.time, 5);
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) errors.push('time');
  const name = str(b.name, 80);
  if (name.length < 2) errors.push('name');
  const phone = normalizePhone(str(b.phone, 30));
  if (!phone) errors.push('phone');
  const email = str(b.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email');
  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      locale: LOCALES.includes(b.locale as Locale) ? (b.locale as Locale) : 'en',
      kind: PARTY_KINDS.includes(b.kind as PartyKind) ? (b.kind as PartyKind) : 'other',
      guests,
      date,
      time: time || undefined,
      name,
      phone: phone!,
      email: email || undefined,
      message: str(b.message, 1000) || undefined,
    },
  };
}
