/**
 * Structured data for search engines: the Restaurant itself, its Menu, and
 * the weekly nights as dated Events.
 *
 * Deliberately no aggregateRating: Google ignores — and may penalise — a
 * business marking up its own reviews, and the 4.6 shown on the page comes
 * from Google itself.
 */
import { addDays, parseClock } from '../domain/schedule';
import type { Locale, MenuItem } from '../domain/types';
import { localized } from '../domain/types';
import type { SiteSettings, SpecialRecord } from '../server/content';
import type { Category } from '../server/menu';
import { fromPrice } from './menuView';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const OFFSET = '-04:00'; // Bávaro: UTC−4 all year
const pesos = (centavos: number) => (centavos / 100).toFixed(2);
/** Profiles the restaurant itself controls; delivery marketplaces are not "the same as". */
const OWN_PROFILES = ['instagram', 'tiktok', 'facebook'];

export function restaurantJsonLd(site: SiteSettings, origin: string, locale: Locale) {
  // Group weekdays with identical hours into one specification each.
  const groups = new Map<string, { days: string[]; opens: string; closes: string }>();
  site.hours.forEach((ranges, day) =>
    ranges.forEach((r) => {
      const closes = r.close === '24:00' ? '23:59' : r.close;
      const key = `${r.open}-${closes}`;
      const g = groups.get(key) ?? { days: [], opens: r.open, closes };
      g.days.push(DAYS[day]!);
      groups.set(key, g);
    }),
  );

  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': `${origin}/#restaurant`,
    name: 'Mezcalito Bar & Grill',
    alternateName: 'Mezcalito RD',
    description: 'Jamaican–Mexican fusion bar and grill in Bávaro, Punta Cana, one block from the beach.',
    url: `${origin}/${locale}/`,
    logo: `${origin}/img/logo.png`,
    image: [`${origin}/og.jpg`, `${origin}/img/place/facade.webp`],
    telephone: site.contact.phone,
    email: site.contact.email,
    servesCuisine: ['Jamaican', 'Mexican', 'Caribbean', 'Fusion'],
    priceRange: 'RD$350–2,000',
    currenciesAccepted: 'DOP, USD',
    paymentAccepted: 'Cash, Credit Card',
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.locality,
      addressRegion: site.address.region,
      addressCountry: site.address.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: site.address.lat, longitude: site.address.lng },
    openingHoursSpecification: [...groups.values()].map((g) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: g.days,
      opens: g.opens,
      closes: g.closes,
    })),
    acceptsReservations: `${origin}/${locale}/reserve`,
    hasMenu: `${origin}/${locale}/menu`,
    sameAs: OWN_PROFILES.map((k) => site.social[k]).filter(Boolean),
  };
}

export function menuJsonLd(categories: Category[], menu: MenuItem[], locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: 'Mezcalito Bar & Grill',
    inLanguage: locale,
    hasMenuSection: categories
      .map((c) => ({
        '@type': 'MenuSection',
        name: localized(c.name, locale),
        hasMenuItem: menu
          .filter((i) => i.categoryId === c.id && !i.hidden)
          .map((i) => ({
            '@type': 'MenuItem',
            name: localized(i.name, locale),
            ...(i.description ? { description: localized(i.description, locale) } : {}),
            offers: { '@type': 'Offer', price: pesos(fromPrice(i)), priceCurrency: 'DOP' },
          })),
      }))
      .filter((s) => s.hasMenuItem.length),
  };
}

export function eventJsonLd(special: SpecialRecord, dates: string[], site: SiteSettings, origin: string, locale: Locale) {
  const overnight = parseClock(special.end) <= parseClock(special.start);
  const clock = (t: string) => (t === '24:00' ? '23:59' : t);
  return dates.map((date) => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: localized(special.title, locale),
    ...(special.body ? { description: localized(special.body, locale) } : {}),
    startDate: `${date}T${special.start}:00${OFFSET}`,
    endDate: `${overnight ? addDays(date, 1) : date}T${clock(special.end)}:00${OFFSET}`,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: 'Mezcalito Bar & Grill',
      address: {
        '@type': 'PostalAddress',
        streetAddress: site.address.street,
        addressLocality: site.address.locality,
        addressRegion: site.address.region,
        addressCountry: site.address.country,
      },
    },
    organizer: { '@type': 'Organization', name: 'Mezcalito Bar & Grill', url: `${origin}/${locale}/` },
    ...(special.price !== null
      ? {
          offers: {
            '@type': 'Offer',
            price: pesos(special.price),
            priceCurrency: 'DOP',
            availability: 'https://schema.org/InStock',
            url: `${origin}/${locale}/${special.cta === 'book' ? 'reserve' : 'menu'}`,
          },
        }
      : {}),
  }));
}
