/**
 * Marketing events: one-off happenings with their own page, a banner on the
 * home page while they run, and a slot in the menu bar. Staff run them under
 * Admin → Events.
 */
import type { EventInput } from '../domain/adminInput';
export { currentEvent, eventTiming } from '../domain/eventDates';
import type { Locale, Localized } from '../domain/types';
import { localized } from '../domain/types';
import { href } from './page';

export interface EventRecord {
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
  cta: EventInput['cta'];
  ctaUrl: string | null;
  ctaLabel: Localized | null;
  highlights: Localized[];
  color: EventInput['color'];
  published: boolean;
  priority: number;
}

const json = <T>(v: unknown): T | null => (v ? (JSON.parse(String(v)) as T) : null);

const row = (r: Record<string, unknown>): EventRecord => ({
  slug: String(r.slug),
  title: JSON.parse(String(r.title)),
  kicker: json(r.kicker),
  body: json(r.body),
  startsOn: String(r.starts_on),
  endsOn: String(r.ends_on),
  startTime: (r.start_time as string | null) ?? null,
  endTime: (r.end_time as string | null) ?? null,
  price: (r.price as number | null) ?? null,
  image: (r.image as string | null) ?? null,
  video: (r.video as string | null) ?? null,
  cta: r.cta as EventInput['cta'],
  ctaUrl: (r.cta_url as string | null) ?? null,
  ctaLabel: json(r.cta_label),
  highlights: json(r.highlights) ?? [],
  color: r.color as EventInput['color'],
  published: !!r.published,
  priority: Number(r.priority),
});

/** Published events that have not ended by `today`, soonest first; `all` for the admin. */
export async function loadEvents(db: D1Database, { all = false, today = '' } = {}): Promise<EventRecord[]> {
  const { results } = all
    ? await db.prepare('SELECT * FROM events ORDER BY starts_on DESC').all<Record<string, unknown>>()
    : await db.prepare('SELECT * FROM events WHERE published = 1 AND ends_on >= ? ORDER BY starts_on, priority DESC').bind(today).all<Record<string, unknown>>();
  return results.map(row);
}

export async function loadEvent(db: D1Database, slug: string): Promise<EventRecord | undefined> {
  const r = await db.prepare('SELECT * FROM events WHERE slug = ?').bind(slug).first<Record<string, unknown>>();
  return r ? row(r) : undefined;
}

export async function saveEvent(db: D1Database, e: EventInput) {
  await db
    .prepare(
      `INSERT INTO events (slug, title, kicker, body, starts_on, ends_on, start_time, end_time, price, image, video, cta, cta_url, cta_label, highlights, color, published, priority)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
       ON CONFLICT (slug) DO UPDATE SET title = ?2, kicker = ?3, body = ?4, starts_on = ?5, ends_on = ?6, start_time = ?7, end_time = ?8, price = ?9,
         image = ?10, video = ?11, cta = ?12, cta_url = ?13, cta_label = ?14, highlights = ?15, color = ?16, published = ?17, priority = ?18,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(
      e.slug,
      JSON.stringify(e.title),
      e.kicker ? JSON.stringify(e.kicker) : null,
      e.body ? JSON.stringify(e.body) : null,
      e.startsOn,
      e.endsOn,
      e.startTime,
      e.endTime,
      e.price,
      e.image,
      e.video,
      e.cta,
      e.ctaUrl,
      e.ctaLabel ? JSON.stringify(e.ctaLabel) : null,
      JSON.stringify(e.highlights),
      e.color,
      Number(e.published),
      e.priority,
    )
    .run();
}

export async function deleteEvent(db: D1Database, slug: string) {
  return (await db.prepare('DELETE FROM events WHERE slug = ?').bind(slug).run()).meta.changes > 0;
}

/** Where the event's button goes, and the dictionary key for its default label. */
export function eventAction(
  e: Pick<EventRecord, 'cta' | 'ctaUrl' | 'title'>,
  locale: Locale,
  whatsapp: string,
): { href: string; key: 'event.book' | 'event.order' | 'event.whatsapp' | 'event.more' } | undefined {
  switch (e.cta) {
    case 'book':
      return { href: href(locale, '/reserve'), key: 'event.book' };
    case 'order':
      return { href: href(locale, '/menu'), key: 'event.order' };
    case 'whatsapp':
      return { href: `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(localized(e.title, locale))}`, key: 'event.whatsapp' };
    case 'link':
      return e.ctaUrl ? { href: e.ctaUrl, key: 'event.more' } : undefined;
    default:
      return undefined;
  }
}
