/**
 * What staff may save from the admin: menu items, nights and offers, and
 * site settings. Every value is checked here before it reaches D1, so a typo
 * in the admin cannot break the guest-facing pages that read it back.
 */
import type { DayOverride, ReservationRules } from './capacity';
import type { SeasonBlock } from './seasonPresets';
import { normalizePhone } from './orderInput';
import type { Closure, DeliveryZone, Localized, PricingSettings, TimeRange, WeeklyHours } from './types';
import { LOCALES } from './types';
import { parseWhatsAppSettings } from './whatsappTemplates';

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const CLOCK = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/;
/** A staff upload in R2 (/media/…) or one of the site's own photos (/img/…). */
const MEDIA = /^\/(media|img)\/[\w./-]{1,120}$/;
/** A video: an R2 upload or one of the site's own clips (/video/…). */
const VIDEO = /^\/(media|video)\/[\w./-]{1,120}\.mp4$/;
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
  /** The extras groups offered with the dish (sides, add-ons), in order. */
  groups?: string[];
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
    else typeof b.photo === 'string' && MEDIA.test(b.photo) ? (out.photo = b.photo) : errors.push('photo');
  }
  if (has('soldOut')) typeof b.soldOut === 'boolean' ? (out.soldOut = b.soldOut) : errors.push('soldOut');
  if (has('hidden')) typeof b.hidden === 'boolean' ? (out.hidden = b.hidden) : errors.push('hidden');
  if (has('groups')) {
    const ok = Array.isArray(b.groups) && b.groups.length <= 10 && b.groups.every((g) => typeof g === 'string' && SLUG.test(g));
    ok ? (out.groups = [...new Set(b.groups as string[])]) : errors.push('groups');
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: out };
}

// ── Categories, variants and extras ───────────────────────────────────────

export interface CategoryInput {
  name: Localized;
  hidden: boolean;
}

export function parseCategory(body: unknown): Parsed<CategoryInput> {
  if (!isObject(body)) return { ok: false, errors: ['body'] };
  const name = parseLocalized(body.name, 60);
  return name ? { ok: true, value: { name, hidden: body.hidden === true } } : { ok: false, errors: ['name'] };
}

export interface PricedChoice {
  /** Kept for an existing choice; a new one gets an id from its name. */
  id?: string;
  label: Localized;
  price: number;
}

/** A dish's sizes or a group's options, replaced as a whole list. */
export function parseChoices(value: unknown, max = 20): Parsed<PricedChoice[]> {
  if (!Array.isArray(value) || value.length > max) return { ok: false, errors: ['list'] };
  const out: PricedChoice[] = [];
  for (const v of value) {
    if (!isObject(v)) return { ok: false, errors: ['list'] };
    const label = parseLocalized(v.label, 60);
    if (!label || !isInt(v.price, 0, 10_000_000)) return { ok: false, errors: ['list'] };
    const id = typeof v.id === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(v.id) ? v.id : undefined;
    out.push({ ...(id ? { id } : {}), label, price: v.price });
  }
  return { ok: true, value: out };
}

export interface GroupInput {
  label: Localized;
  min: number;
  max: number;
  options: PricedChoice[];
}

export function parseGroup(body: unknown): Parsed<GroupInput> {
  if (!isObject(body)) return { ok: false, errors: ['body'] };
  const errors: string[] = [];
  const label = parseLocalized(body.label, 60);
  if (!label) errors.push('label');
  const min = isInt(body.min, 0, 10) ? body.min : (errors.push('min'), 0);
  const max = isInt(body.max, 1, 20) && body.max >= min ? body.max : (errors.push('max'), 1);
  const options = parseChoices(body.options, 30);
  if (!options.ok) errors.push('options');
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { label: label!, min, max, options: options.ok ? options.value : [] } };
}

// ── Polaroid wall ─────────────────────────────────────────────────────────

export interface GalleryInput {
  kind: 'photo' | 'video';
  src: string;
  poster: string | null;
  caption: Localized;
  tilt: number;
  onHome: boolean;
  onHero: boolean;
  published: boolean;
}

export function parseGallery(body: unknown): Parsed<GalleryInput> {
  if (!isObject(body)) return { ok: false, errors: ['body'] };
  const errors: string[] = [];
  const kind = body.kind === 'video' ? 'video' : 'photo';
  const src = typeof body.src === 'string' && (kind === 'video' ? VIDEO : MEDIA).test(body.src) ? body.src : (errors.push('src'), '');
  const poster = body.poster === null || body.poster === undefined || body.poster === '' ? null : typeof body.poster === 'string' && MEDIA.test(body.poster) ? body.poster : (errors.push('poster'), null);
  const caption = parseLocalized(body.caption, 60);
  if (!caption) errors.push('caption');
  const tilt = isNum(body.tilt, -12, 12) ? Math.round(body.tilt * 10) / 10 : (errors.push('tilt'), 0);
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { kind, src, poster, caption: caption!, tilt, onHome: body.onHome !== false, onHero: body.onHero === true, published: body.published !== false } };
}

// ── Marketing events ──────────────────────────────────────────────────────

export const EVENT_CTAS = ['order', 'book', 'whatsapp', 'link', 'none'] as const;

export interface EventInput {
  slug: string;
  title: Localized;
  kicker: Localized | null;
  body: Localized | null;
  startsOn: string;
  endsOn: string;
  startTime: string | null;
  endTime: string | null;
  price: number | null;
  image: string | null;
  video: string | null;
  cta: (typeof EVENT_CTAS)[number];
  ctaUrl: string | null;
  ctaLabel: Localized | null;
  highlights: Localized[];
  color: (typeof PALETTE)[number];
  published: boolean;
  priority: number;
}

const optionalLocalized = (v: unknown, max: number) => (isObject(v) && text(v.en, max) ? parseLocalized(v, max) ?? null : null);

export function parseEvent(body: unknown): Parsed<EventInput> {
  if (!isObject(body)) return { ok: false, errors: ['body'] };
  const b = body;
  const errors: string[] = [];
  const slug = text(b.slug, 40);
  if (!SLUG.test(slug)) errors.push('slug');
  const title = parseLocalized(b.title, 80);
  if (!title) errors.push('title');
  if (!isDate(b.startsOn)) errors.push('startsOn');
  if (!isDate(b.endsOn) || (isDate(b.startsOn) && b.endsOn < b.startsOn)) errors.push('endsOn');
  const clock = (v: unknown, key: string) => (v === null || v === undefined || v === '' ? null : typeof v === 'string' && CLOCK.test(v) ? v : (errors.push(key), null));
  const startTime = clock(b.startTime, 'startTime');
  const endTime = clock(b.endTime, 'endTime');
  const price = b.price === null || b.price === undefined || b.price === '' ? null : isInt(b.price, 0, 10_000_000) ? b.price : (errors.push('price'), null);
  const image = b.image === null || b.image === undefined || b.image === '' ? null : typeof b.image === 'string' && MEDIA.test(b.image) ? b.image : (errors.push('image'), null);
  const video = b.video === null || b.video === undefined || b.video === '' ? null : typeof b.video === 'string' && VIDEO.test(b.video) ? b.video : (errors.push('video'), null);
  const cta = EVENT_CTAS.includes(b.cta as never) ? (b.cta as EventInput['cta']) : (errors.push('cta'), 'none' as const);
  const ctaUrl = b.ctaUrl ? (typeof b.ctaUrl === 'string' && /^https:\/\/\S{4,300}$/.test(b.ctaUrl) ? b.ctaUrl : (errors.push('ctaUrl'), null)) : null;
  if (cta === 'link' && !ctaUrl) errors.push('ctaUrl');
  const highlights = Array.isArray(b.highlights) && b.highlights.length <= 8 ? b.highlights.map((h) => parseLocalized(h, 120)) : [undefined];
  if (!highlights.every(Boolean)) errors.push('highlights');
  const color = PALETTE.includes(b.color as never) && b.color !== 'cream' ? (b.color as EventInput['color']) : (errors.push('color'), 'hibiscus' as const);
  const priority = b.priority === undefined ? 0 : isInt(b.priority, 0, 100) ? b.priority : (errors.push('priority'), 0);
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };
  return {
    ok: true,
    value: {
      slug,
      title: title!,
      kicker: optionalLocalized(b.kicker, 80),
      body: optionalLocalized(b.body, 2000),
      startsOn: b.startsOn as string,
      endsOn: b.endsOn as string,
      startTime,
      endTime,
      price,
      image,
      video,
      cta,
      ctaUrl,
      ctaLabel: optionalLocalized(b.ctaLabel, 40),
      highlights: highlights as Localized[],
      color,
      published: b.published === true,
      priority,
    },
  };
}

// ── Payment credentials (private, never in `settings`) ────────────────────

export interface PaymentCredentials {
  azul?: { merchantId: string; merchantName: string; merchantType: string; authKey: string; mode: 'test' | 'live' };
  paypal?: { clientId: string; secret: string; mode: 'test' | 'live' };
}

/**
 * Credentials typed in the admin. A secret left blank keeps the stored one,
 * so the form never needs to show it; `clear` removes a provider.
 */
export function parseCredentials(body: unknown, stored: PaymentCredentials): Parsed<PaymentCredentials> {
  if (!isObject(body)) return { ok: false, errors: ['body'] };
  const out: PaymentCredentials = { ...stored };
  const errors: string[] = [];
  const mode = (v: unknown) => (v === 'live' ? 'live' : 'test') as 'test' | 'live';
  if (isObject(body.azul)) {
    const a = body.azul;
    if (a.clear === true) delete out.azul;
    else {
      const merchantId = text(a.merchantId, 40);
      const authKey = text(a.authKey, 200) || stored.azul?.authKey || '';
      if (!/^[\w-]{3,40}$/.test(merchantId)) errors.push('azul.merchantId');
      if (!authKey) errors.push('azul.authKey');
      out.azul = { merchantId, merchantName: text(a.merchantName, 60) || 'Mezcalito Bar and Grill', merchantType: text(a.merchantType, 40) || 'Restaurant', authKey, mode: mode(a.mode) };
    }
  }
  if (isObject(body.paypal)) {
    const p = body.paypal;
    if (p.clear === true) delete out.paypal;
    else {
      const clientId = text(p.clientId, 200);
      const secret = text(p.secret, 200) || stored.paypal?.secret || '';
      if (!/^[\w-]{10,200}$/.test(clientId)) errors.push('paypal.clientId');
      if (!secret) errors.push('paypal.secret');
      out.paypal = { clientId, secret, mode: mode(p.mode) };
    }
  }
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
  image: string | null;
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
  const image = b.image === null || b.image === undefined || b.image === '' ? null : typeof b.image === 'string' && MEDIA.test(b.image) ? b.image : (errors.push('image'), null);
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
      image,
      active: b.active !== false,
    },
  };
}

// ── Seasons ───────────────────────────────────────────────────────────────

export interface SeasonInput {
  slug: string;
  name: Localized;
  startsOn: string;
  endsOn: string;
  priority: number;
  published: boolean;
  tokens: Record<string, string>;
  hero: { kicker: Localized; headline: Localized; body: Localized; cta: 'order' | 'book' };
  blocks: SeasonBlock[];
  playlistUrl: string | null;
  ogImage: string | null;
}

function parseBlock(v: unknown): SeasonBlock | undefined {
  if (!isObject(v)) return undefined;
  const ids = (list: unknown) =>
    Array.isArray(list) && list.length <= 20 && list.every((i) => typeof i === 'string' && /^[a-z0-9-]{1,60}$/.test(i)) ? (list as string[]) : undefined;
  switch (v.type) {
    case 'story': {
      const title = parseLocalized(v.title, 80);
      const body = parseLocalized(v.body, 1200);
      return title && body ? { type: 'story', title, body } : undefined;
    }
    case 'dishes': {
      const title = parseLocalized(v.title, 80);
      const itemIds = ids(v.itemIds);
      return title && itemIds ? { type: 'dishes', title, itemIds } : undefined;
    }
    case 'nights': {
      const specialIds = ids(v.specialIds);
      return specialIds ? { type: 'nights', specialIds } : undefined;
    }
    case 'gallery': {
      const ok = Array.isArray(v.images) && v.images.length <= 12 && v.images.every((i) => typeof i === 'string' && MEDIA.test(i));
      return ok ? { type: 'gallery', images: v.images as string[] } : undefined;
    }
    default:
      return undefined;
  }
}

export function parseSeason(body: unknown): Parsed<SeasonInput> {
  if (!isObject(body)) return { ok: false, errors: ['body'] };
  const b = body;
  const errors: string[] = [];
  const slug = text(b.slug, 40);
  if (!SLUG.test(slug)) errors.push('slug');
  const name = parseLocalized(b.name, 60);
  if (!name) errors.push('name');
  if (!isDate(b.startsOn)) errors.push('startsOn');
  if (!isDate(b.endsOn) || (isDate(b.startsOn) && b.endsOn < b.startsOn)) errors.push('endsOn');
  const priority = isInt(b.priority, 0, 100) ? b.priority : (errors.push('priority'), 0);
  // Only the palette's own colours, as plain hex, can be overridden.
  const tokens: Record<string, string> = {};
  if (!isObject(b.tokens)) errors.push('tokens');
  else
    for (const [k, v] of Object.entries(b.tokens)) {
      const name = k.replace(/^--c-/, '');
      if (!PALETTE.includes(name as never) || typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) {
        errors.push('tokens');
        break;
      }
      tokens[`--c-${name}`] = v.toLowerCase();
    }
  const h = isObject(b.hero) ? b.hero : {};
  const kicker = parseLocalized(h.kicker, 60);
  const headline = parseLocalized(h.headline, 80);
  const heroBody = parseLocalized(h.body, 300);
  const cta = h.cta === 'order' || h.cta === 'book' ? h.cta : undefined;
  if (!kicker || !headline || !heroBody || !cta) errors.push('hero');
  const blocks = Array.isArray(b.blocks) && b.blocks.length <= 12 ? b.blocks.map(parseBlock) : [undefined];
  if (!blocks.every(Boolean)) errors.push('blocks');
  const playlistUrl = b.playlistUrl ? (typeof b.playlistUrl === 'string' && /^https:\/\/\S{4,300}$/.test(b.playlistUrl) ? b.playlistUrl : (errors.push('playlistUrl'), null)) : null;
  const ogImage = b.ogImage ? (typeof b.ogImage === 'string' && MEDIA.test(b.ogImage) ? b.ogImage : (errors.push('ogImage'), null)) : null;
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };
  return {
    ok: true,
    value: {
      slug,
      name: name!,
      startsOn: b.startsOn as string,
      endsOn: b.endsOn as string,
      priority,
      published: b.published === true,
      tokens,
      hero: { kicker: kicker!, headline: headline!, body: heroBody!, cta: cta! },
      blocks: blocks as SeasonBlock[],
      playlistUrl,
      ogImage,
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

/** The Radio's music bed: an uploaded, licensed mp3, or none for the built-in riddim. */
const parseRadio = (v: unknown) =>
  isObject(v) && (v.bed === null || (typeof v.bed === 'string' && /^\/media\/radio\/[\w-]{1,80}\.mp3$/.test(v.bed))) ? { bed: v.bed as string | null } : undefined;

export interface PaymentSettings {
  cash: boolean;
  cardOnDelivery: boolean;
  azul: boolean;
  paypal: boolean;
  /** Shown at checkout, e.g. "We take US dollars and euros in cash". */
  note: Localized | null;
}

/** Which ways to pay guests are offered, and a note shown at checkout. */
const parsePayments = (v: unknown): PaymentSettings | undefined => {
  if (!isObject(v)) return undefined;
  const note = (isObject(v.note) && text(v.note.en, 300) ? parseLocalized(v.note, 300) : null) ?? null;
  const flag = (k: string) => v[k] !== false;
  const out = { cash: flag('cash'), cardOnDelivery: flag('cardOnDelivery'), azul: flag('azul'), paypal: flag('paypal'), note };
  // Guests must always have some way to pay: with everything off, cash stays on.
  if (!out.cash && !out.cardOnDelivery && !out.azul && !out.paypal) out.cash = true;
  return out;
};

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
  radio: parseRadio,
  whatsapp: parseWhatsAppSettings,
  payments: parsePayments,
} satisfies Record<string, (v: unknown) => unknown>;

export type SettingKey = keyof typeof SETTINGS;
export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

export function parseSetting(key: string, value: unknown): Parsed<unknown> {
  if (!(key in SETTINGS)) return { ok: false, errors: ['key'] };
  const parsed = SETTINGS[key as SettingKey](value);
  return parsed === undefined ? { ok: false, errors: [key] } : { ok: true, value: parsed };
}
