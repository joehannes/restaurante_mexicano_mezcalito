/**
 * What staff may save from the admin: menu items, nights and offers, and
 * site settings. Every value is checked here before it reaches D1, so a typo
 * in the admin cannot break the guest-facing pages that read it back.
 */
import type { DayOverride, ReservationRules } from './capacity';
import { normalizePhone } from './orderInput';
import type { Closure, DeliveryZone, Localized, PricingSettings, TimeRange, WeeklyHours } from './types';
import { LOCALES } from './types';

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const CLOCK = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/;
/** Palette names a flyer may use; they map to the --c-* custom properties. */
export const PALETTE = ['ink', 'cream', 'gold', 'hibiscus', 'jungle', 'sunset', 'lagoon', 'mezcal'] as const;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isNum = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isDate = (v: unknown): v is string => typeof v === 'string' && DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Text in every language: English required, the rest optional. */
export function parseLocalized(value: unknown, max = 400): Localized | undefined {
  if (!isObject(value)) return undefined;
  const en = text(value.en, max);
  if (!en) return undefined;
  const out: Localized = { en };
  for (const locale of LOCALES) {
    if (locale === 'en') continue;
    const t = text(value[locale], max);
    if (t) out[locale] = t;
  }
  return out;
}

const parseRange = (v: unknown): TimeRange | undefined =>
  isObject(v) && typeof v.open === 'string' && typeof v.close === 'string' && CLOCK.test(v.open) && CLOCK.test(v.close) && v.open !== '24:00'
    ? { open: v.open, close: v.close }
    : undefined;

const parseRanges = (v: unknown): TimeRange[] | undefined => {
  if (!Array.isArray(v) || v.length > 4) return undefined;
  const ranges = v.map(parseRange);
  return ranges.every(Boolean) ? (ranges as TimeRange[]) : undefined;
};

// ── Menu items ────────────────────────────────────────────────────────────

export interface ItemPatch {
  categoryId?: string;
  name?: Localized;
  description?: Localized | null;
  price?: number;
  unit?: 'each' | 'lb';
  heat?: number;
  fusion?: number;
  tags?: string[];
  photo?: string | null;
  soldOut?: boolean;
  hidden?: boolean;
}

/** A partial update to a dish; only the fields present are checked and kept. */
export function parseItemPatch(body: unknown): Parsed<ItemPatch> {
  if (!isObject(body)) return { ok: false, errors: ['body'] };
  const b = body;
  const out: ItemPatch = {};
  const errors: string[] = [];
  const has = (k: string) => k in b;

  if (has('categoryId')) typeof b.categoryId === 'string' && SLUG.test(b.categoryId) ? (out.categoryId = b.categoryId) : errors.push('categoryId');
  if (has('name')) {
    const name = parseLocalized(b.name, 80);
    name ? (out.name = name) : errors.push('name');
  }
  if (has('description')) {
    if (b.description === null || (isObject(b.description) && !text(b.description.en, 400))) out.description = null;
    else {
      const d = parseLocalized(b.description, 400);
      d ? (out.description = d) : errors.push('description');
    }
  }
  if (has('price')) isInt(b.price, 0, 10_000_000) ? (out.price = b.price) : errors.push('price');
  if (has('unit')) b.unit === 'each' || b.unit === 'lb' ? (out.unit = b.unit) : errors.push('unit');
  if (has('heat')) isInt(b.heat, 0, 5) ? (out.heat = b.heat) : errors.push('heat');
  if (has('fusion')) isInt(b.fusion, -2, 2) ? (out.fusion = b.fusion) : errors.push('fusion');
  if (has('tags')) {
    const ok = Array.isArray(b.tags) && b.tags.length <= 12 && b.tags.every((t) => typeof t === 'string' && /^[a-z0-9-]{1,24}$/.test(t));
    ok ? (out.tags = [...new Set(b.tags as string[])]) : errors.push('tags');
  }
  if (has('photo')) {
    if (b.photo === null || b.photo === '') out.photo = null;
    else typeof b.photo === 'string' && /^\/media\/[\w./-]{1,120}$/.test(b.photo) ? (out.photo = b.photo) : errors.push('photo');
  }
  if (has('soldOut')) typeof b.soldOut === 'boolean' ? (out.soldOut = b.soldOut) : errors.push('soldOut');
  if (has('hidden')) typeof b.hidden === 'boolean' ? (out.hidden = b.hidden) : errors.push('hidden');
  return errors.length ? { ok: false, errors } : { ok: true, value: out };
}

// ── Nights and offers ─────────────────────────────────────────────────────

export interface SpecialInput {
  id: string;
  title: Localized;
  body: Localized | null;
  days: number[];
  start: string;
  end: string;
  validFrom: string | null;
  validTo: string | null;
  price: number | null;
  cta: 'order' | 'book' | 'none';
  itemIds: string[];
  flyer: { bg: string; ink: string; sticker?: string };
  active: boolean;
}

export function parseSpecial(body: unknown): Parsed<SpecialInput> {
  if (!isObject(body)) return { ok: false, errors: ['body'] };
  const b = body;
  const errors: string[] = [];
  const id = text(b.id, 40);
  if (!SLUG.test(id)) errors.push('id');
  const title = parseLocalized(b.title, 60);
  if (!title) errors.push('title');
  const bodyText = isObject(b.body) && text(b.body.en, 300) ? parseLocalized(b.body, 300) : null;
  const days = Array.isArray(b.days) && b.days.every((d) => isInt(d, 0, 6)) ? [...new Set(b.days as number[])].sort() : undefined;
  if (!days) errors.push('days');
  const start = text(b.start, 5);
  if (!CLOCK.test(start) || start === '24:00') errors.push('start');
  const end = text(b.end, 5);
  if (!CLOCK.test(end)) errors.push('end');
  const validFrom = b.validFrom ? (isDate(b.validFrom) ? b.validFrom : (errors.push('validFrom'), null)) : null;
  const validTo = b.validTo ? (isDate(b.validTo) ? b.validTo : (errors.push('validTo'), null)) : null;
  if (validFrom && validTo && validTo < validFrom) errors.push('validTo');
  const price = b.price === null || b.price === undefined || b.price === '' ? null : isInt(b.price, 0, 10_000_000) ? b.price : (errors.push('price'), null);
  const cta = b.cta === 'order' || b.cta === 'book' || b.cta === 'none' ? b.cta : (errors.push('cta'), 'none' as const);
  const itemIds = Array.isArray(b.itemIds) && b.itemIds.every((i) => typeof i === 'string' && i.length <= 60) ? (b.itemIds as string[]).slice(0, 20) : [];
  const f = isObject(b.flyer) ? b.flyer : {};
  const bg = PALETTE.includes(f.bg as never) ? (f.bg as string) : undefined;
  const ink = PALETTE.includes(f.ink as never) ? (f.ink as string) : undefined;
  if (!bg || !ink || bg === ink) errors.push('flyer');
  const sticker = text(f.sticker, 12);
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id,
      title: title!,
      body: bodyText ?? null,
      days: days!,
      start,
      end,
      validFrom,
      validTo,
      price,
      cta,
      itemIds,
      flyer: { bg: bg!, ink: ink!, ...(sticker ? { sticker } : {}) },
      active: b.active !== false,
    },
  };
}

// ── Settings ──────────────────────────────────────────────────────────────

const parseHours = (v: unknown): WeeklyHours | undefined => {
  if (!Array.isArray(v) || v.length !== 7) return undefined;
  const days = v.map(parseRanges);
  return days.every(Boolean) ? (days as WeeklyHours) : undefined;
};

const parseClosures = (v: unknown): Closure[] | undefined => {
  if (!Array.isArray(v) || v.length > 100) return undefined;
  const out: Closure[] = [];
  for (const c of v) {
    if (!isObject(c) || !isDate(c.date)) return undefined;
    const ranges = parseRanges(c.ranges ?? []);
    if (!ranges) return undefined;
    const reason = text(c.reason, 80);
    out.push({ date: c.date, ranges, ...(reason ? { reason } : {}) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
};

const parsePricing = (v: unknown): PricingSettings | undefined => {
  if (!isObject(v) || !isObject(v.serviceRate)) return undefined;
  const s = v.serviceRate;
  if (!isNum(v.itbisRate, 0, 0.5) || !isNum(s.dine_in, 0, 0.3) || !isNum(s.pickup, 0, 0.3) || !isNum(s.delivery, 0, 0.3)) return undefined;
  if (!isNum(v.usdRate, 1, 1000) || !isNum(v.weightStepLb, 0.1, 5) || !isNum(v.minWeightLb, 0.1, 20) || !isInt(v.maxQtyPerLine, 1, 200)) return undefined;
  return {
    itbisRate: v.itbisRate,
    serviceRate: { dine_in: s.dine_in, pickup: s.pickup, delivery: s.delivery },
    usdRate: v.usdRate,
    weightStepLb: v.weightStepLb,
    minWeightLb: v.minWeightLb,
    maxQtyPerLine: v.maxQtyPerLine,
  };
};

const parseZones = (v: unknown): DeliveryZone[] | undefined => {
  if (!Array.isArray(v) || v.length > 20) return undefined;
  const out: DeliveryZone[] = [];
  for (const z of v) {
    if (!isObject(z) || !SLUG.test(text(z.id, 40)) || !text(z.name, 60)) return undefined;
    if (!isInt(z.fee, 0, 10_000_000) || !isInt(z.minOrder, 0, 10_000_000)) return undefined;
    const polygon = z.polygon;
    if (!Array.isArray(polygon) || polygon.length < 3 || polygon.length > 200) return undefined;
    if (!polygon.every((p) => Array.isArray(p) && p.length === 2 && isNum(p[0], -180, 180) && isNum(p[1], -90, 90))) return undefined;
    out.push({ id: text(z.id, 40), name: text(z.name, 60), polygon: polygon as [number, number][], fee: z.fee, minOrder: z.minOrder });
  }
  return out;
};

const parseRules = (v: unknown): ReservationRules | undefined => {
  if (!isObject(v)) return undefined;
  const { slotMinutes, seatingMinutes, capacity, maxParty, minLeadMinutes, maxDaysAhead } = v;
  if (!isInt(slotMinutes, 10, 120) || !isInt(seatingMinutes, 30, 300) || !isInt(capacity, 1, 1000) || !isInt(maxParty, 1, 100)) return undefined;
  if (!isInt(minLeadMinutes, 0, 2880) || !isInt(maxDaysAhead, 1, 365)) return undefined;
  const windows = parseHours(v.windows);
  if (!windows) return undefined;
  if (!Array.isArray(v.overrides) || v.overrides.length > 200) return undefined;
  const overrides: DayOverride[] = [];
  for (const o of v.overrides) {
    if (!isObject(o) || !isDate(o.date)) return undefined;
    const override: DayOverride = { date: o.date };
    if (o.closed === true) override.closed = true;
    if (o.capacity !== undefined) {
      if (!isInt(o.capacity, 0, 1000)) return undefined;
      override.capacity = o.capacity;
    }
    if (o.windows !== undefined) {
      const w = parseRanges(o.windows);
      if (!w) return undefined;
      override.windows = w;
    }
    overrides.push(override);
  }
  return { slotMinutes, seatingMinutes, capacity, maxParty, minLeadMinutes, maxDaysAhead, windows, overrides };
};

const parseContact = (v: unknown) => {
  if (!isObject(v)) return undefined;
  const phone = normalizePhone(text(v.phone, 30));
  const whatsapp = normalizePhone(text(v.whatsapp, 30));
  const email = text(v.email, 120);
  if (!phone || !whatsapp || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return undefined;
  return { phone, whatsapp, email, confirmed: v.confirmed === true };
};

const parseAddress = (v: unknown) => {
  if (!isObject(v)) return undefined;
  const note = parseLocalized(v.note, 120);
  const [street, locality, region, country] = [text(v.street, 120), text(v.locality, 60), text(v.region, 60), text(v.country, 2)];
  if (!street || !locality || !region || !/^[A-Z]{2}$/.test(country) || !isNum(v.lat, -90, 90) || !isNum(v.lng, -180, 180) || !note) return undefined;
  return { street, locality, region, country, lat: v.lat, lng: v.lng, note };
};

const parseSocial = (v: unknown) => {
  if (!isObject(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, url] of Object.entries(v)) {
    if (!/^[a-z]{2,20}$/.test(k) || typeof url !== 'string') return undefined;
    if (!url) continue;
    if (!/^https:\/\/[^\s]+$/.test(url) || url.length > 300) return undefined;
    out[k] = url;
  }
  return out;
};

const parseReviews = (v: unknown) =>
  isObject(v) && isNum(v.rating, 0, 5) && isInt(v.count, 0, 1_000_000) && text(v.source, 30) && /^\d{4}-\d{2}$/.test(text(v.asOf, 7))
    ? { rating: v.rating, count: v.count, source: text(v.source, 30), asOf: text(v.asOf, 7) }
    : undefined;

const SETTINGS = {
  hours: parseHours,
  closures: parseClosures,
  contact: parseContact,
  address: parseAddress,
  social: parseSocial,
  reviewsSummary: parseReviews,
  pricing: parsePricing,
  deliveryZones: parseZones,
  reservations: parseRules,
} satisfies Record<string, (v: unknown) => unknown>;

export type SettingKey = keyof typeof SETTINGS;
export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

export function parseSetting(key: string, value: unknown): Parsed<unknown> {
  if (!(key in SETTINGS)) return { ok: false, errors: ['key'] };
  const parsed = SETTINGS[key as SettingKey](value);
  return parsed === undefined ? { ok: false, errors: [key] } : { ok: true, value: parsed };
}
