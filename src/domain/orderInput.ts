/**
 * What a guest may send when placing an order, checked before anything
 * touches the database. Only ids, choices and quantities are accepted for the
 * food — prices come from the menu on the server.
 */
import { LOCALES, type CartLine, type Locale, type OrderMode } from './types';

export type PaymentMethod = 'cash' | 'card_on_delivery' | 'online';

export interface OrderInput {
  locale: Locale;
  mode: OrderMode;
  lines: CartLine[];
  name: string;
  phone: string;
  email?: string;
  address?: { street: string; reference?: string; lat?: number; lng?: number };
  table?: string;
  notes?: string;
  payment: PaymentMethod;
  /** `asap`, or an HH:MM slot later today. */
  when: string;
}

export type FieldError =
  | 'body'
  | 'mode'
  | 'lines'
  | 'name'
  | 'phone'
  | 'email'
  | 'address'
  | 'table'
  | 'payment'
  | 'when';

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const MODES: OrderMode[] = ['pickup', 'delivery', 'dine_in'];
const PAYMENTS: PaymentMethod[] = ['cash', 'card_on_delivery', 'online'];

/** Digits only, with a leading + kept; Dominican 10-digit numbers get +1. */
export function normalizePhone(raw: string): string | undefined {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 10 && /^8[024]9/.test(digits)) return `+1${digits}`;
  if (digits.length < 8 || digits.length > 15) return undefined;
  return `+${digits}`;
}

function cleanLines(value: unknown): CartLine[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 40) return undefined;
  const lines: CartLine[] = [];
  for (const raw of value as Record<string, unknown>[]) {
    if (!raw || typeof raw.itemId !== 'string' || typeof raw.qty !== 'number') return undefined;
    const options: Record<string, string[]> = {};
    if (raw.options && typeof raw.options === 'object') {
      for (const [group, ids] of Object.entries(raw.options as Record<string, unknown>)) {
        if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) return undefined;
        options[group.slice(0, 40)] = (ids as string[]).slice(0, 10).map((id) => id.slice(0, 40));
      }
    }
    lines.push({
      itemId: raw.itemId.slice(0, 60),
      variantId: typeof raw.variantId === 'string' ? raw.variantId.slice(0, 40) : undefined,
      qty: raw.qty,
      weightLb: typeof raw.weightLb === 'number' ? raw.weightLb : undefined,
      options,
      note: str(raw.note, 200) || undefined,
    });
  }
  return lines;
}

export function parseOrderInput(body: unknown): { ok: true; value: OrderInput } | { ok: false; errors: FieldError[] } {
  if (!body || typeof body !== 'object') return { ok: false, errors: ['body'] };
  const b = body as Record<string, unknown>;
  const errors: FieldError[] = [];

  const locale = LOCALES.includes(b.locale as Locale) ? (b.locale as Locale) : 'en';
  const mode = MODES.includes(b.mode as OrderMode) ? (b.mode as OrderMode) : undefined;
  if (!mode) errors.push('mode');
  const lines = cleanLines(b.lines);
  if (!lines) errors.push('lines');
  const name = str(b.name, 80);
  if (name.length < 2) errors.push('name');
  const phone = normalizePhone(str(b.phone, 30));
  if (!phone) errors.push('phone');
  const email = str(b.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email');
  const payment = PAYMENTS.includes(b.payment as PaymentMethod) ? (b.payment as PaymentMethod) : undefined;
  if (!payment) errors.push('payment');
  const when = str(b.when, 5);
  if (when !== 'asap' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(when)) errors.push('when');

  let address: OrderInput['address'];
  if (mode === 'delivery') {
    const a = (b.address ?? {}) as Record<string, unknown>;
    const street = str(a.street, 160);
    if (street.length < 4) errors.push('address');
    address = {
      street,
      reference: str(a.reference, 160) || undefined,
      lat: typeof a.lat === 'number' ? a.lat : undefined,
      lng: typeof a.lng === 'number' ? a.lng : undefined,
    };
  }
  const table = str(b.table, 12);
  if (mode === 'dine_in' && !table) errors.push('table');

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      locale,
      mode: mode!,
      lines: lines!,
      name,
      phone: phone!,
      email: email || undefined,
      address,
      table: mode === 'dine_in' ? table : undefined,
      notes: str(b.notes, 500) || undefined,
      payment: payment!,
      when,
    },
  };
}

const CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY3479';

/** A short code a guest can read out over the phone: MZ-7KQ4. No 0/O, 1/I/L. */
export function orderCode(random: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return `MZ-${code}`;
}
