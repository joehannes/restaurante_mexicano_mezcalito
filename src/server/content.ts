/**
 * Site-wide content read on almost every page: settings, nights, seasons.
 */
import type { SeasonBlock } from '../domain/seasonPresets';
import type { Closure, Localized, Season, Special, WeeklyHours } from '../domain/types';

export interface SiteSettings {
  hours: WeeklyHours;
  closures: Closure[];
  contact: { phone: string; whatsapp: string; email: string };
  address: { street: string; locality: string; region: string; country: string; lat: number; lng: number; note: Localized };
  social: Record<string, string>;
  reviewsSummary?: { rating: number; count: number; source: string; asOf: string };
  pricing: import('../domain/types').PricingSettings;
  deliveryZones: import('../domain/types').DeliveryZone[];
}

export interface SpecialRecord extends Special {
  body: Localized | undefined;
  price: number | null;
  cta: 'order' | 'book' | 'none';
  itemIds: string[];
  flyer: { bg: string; ink: string; sticker?: string };
  image: string | null;
}

export interface SeasonRecord extends Season {
  name: Localized;
  tokens: Record<string, string>;
  hero: { kicker: Localized; headline: Localized; body: Localized; cta: 'order' | 'book' };
  blocks: SeasonBlock[];
  playlistUrl: string | null;
  ogImage: string | null;
}

const parse = <T>(json: string | null): T => (json ? JSON.parse(json) : undefined) as T;

export async function loadSite(db: D1Database) {
  const [settings, specials, seasons] = await db.batch([
    db.prepare('SELECT key, value FROM settings'),
    db.prepare('SELECT * FROM specials ORDER BY position'),
    db.prepare('SELECT * FROM seasons'),
  ]);
  const site = Object.fromEntries(
    (settings!.results as { key: string; value: string }[]).map((r) => [r.key, JSON.parse(r.value)]),
  ) as SiteSettings;

  const specialRecords = (specials!.results as Record<string, string | number | null>[]).map(
    (r): SpecialRecord => ({
      id: String(r.id),
      title: parse(r.title as string),
      body: parse(r.body as string | null),
      days: parse(r.days as string),
      start: String(r.start_time),
      end: String(r.end_time),
      validFrom: (r.valid_from as string | null) ?? undefined,
      validTo: (r.valid_to as string | null) ?? undefined,
      active: !!r.active,
      price: r.price as number | null,
      cta: r.cta as SpecialRecord['cta'],
      itemIds: parse(r.item_ids as string),
      flyer: parse(r.flyer as string),
      image: (r.image as string | null) ?? null,
    }),
  );

  const seasonRecords = (seasons!.results as Record<string, string | number | null>[]).map(
    (r): SeasonRecord => ({
      slug: String(r.slug),
      name: parse(r.name as string),
      startsOn: String(r.starts_on),
      endsOn: String(r.ends_on),
      priority: Number(r.priority),
      published: !!r.published,
      tokens: parse(r.tokens as string),
      hero: parse(r.hero as string),
      blocks: parse(r.blocks as string),
      playlistUrl: (r.playlist_url as string | null) ?? null,
      ogImage: (r.og_image as string | null) ?? null,
    }),
  );

  return { site, specials: specialRecords, seasons: seasonRecords.sort((a, b) => a.startsOn.localeCompare(b.startsOn)) };
}
