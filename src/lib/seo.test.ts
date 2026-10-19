import { describe, expect, it } from 'vitest';
import { eventJsonLd, menuJsonLd, restaurantJsonLd } from './seo';
import type { MenuItem } from '../domain/types';

const site = {
  hours: Array.from({ length: 7 }, () => [{ open: '08:00', close: '24:00' }]),
  closures: [],
  contact: { phone: '+18099591646', whatsapp: '+18092120782', email: 'info@mezcalitobarandgrill.com' },
  address: { street: 'Calle Pedro Mir', locality: 'Bávaro', region: 'La Altagracia', country: 'DO', lat: 18.69218, lng: -68.42596, note: { en: 'x' } },
  social: { instagram: 'https://www.instagram.com/mezcalitord/', ubereats: 'https://ubereats.example' },
  pricing: { itbisRate: 0.18, serviceRate: { dine_in: 0.1, pickup: 0.1, delivery: 0.1 }, usdRate: 63, weightStepLb: 0.5, minWeightLb: 1, maxQtyPerLine: 20 },
  deliveryZones: [],
};

describe('restaurantJsonLd', () => {
  const ld = restaurantJsonLd(site, 'https://mezcalitobarandgrill.com', 'en');
  it('describes the restaurant with address, geo and hours', () => {
    expect(ld['@type']).toBe('Restaurant');
    expect(ld.address).toMatchObject({ streetAddress: 'Calle Pedro Mir', addressLocality: 'Bávaro', addressCountry: 'DO' });
    expect(ld.geo).toEqual({ '@type': 'GeoCoordinates', latitude: 18.69218, longitude: -68.42596 });
    expect(ld.openingHoursSpecification).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: '08:00',
        closes: '23:59',
      },
    ]);
    expect(ld.acceptsReservations).toBe('https://mezcalitobarandgrill.com/en/reserve');
    expect(ld.hasMenu).toBe('https://mezcalitobarandgrill.com/en/menu');
  });
  it('only lists profiles the restaurant controls in sameAs', () => {
    expect(ld.sameAs).toEqual(['https://www.instagram.com/mezcalitord/']);
  });
  it('never claims an aggregate rating from third-party reviews', () => {
    expect(ld).not.toHaveProperty('aggregateRating');
  });
});

describe('menuJsonLd', () => {
  const item = (o: Partial<MenuItem>): MenuItem => ({
    id: 'x', categoryId: 'tacos', name: { en: 'X' }, price: 49_500, unit: 'each', heat: 0, fusion: 0, tags: [], soldOut: false, hidden: false, ...o,
  });
  it('groups dishes by section with peso offers, skipping hidden ones', () => {
    const ld = menuJsonLd(
      [{ id: 'tacos', name: { en: 'Tacos & more' } }],
      [item({ id: 'a', name: { en: 'Oxtail taco' } }), item({ id: 'b', hidden: true }), item({ id: 'c', name: { en: 'Quesadillas' }, variants: [{ id: 'v', label: { en: 'Cheese' }, price: 49_000 }] })],
      'en',
    );
    expect(ld.hasMenuSection).toEqual([
      {
        '@type': 'MenuSection',
        name: 'Tacos & more',
        hasMenuItem: [
          { '@type': 'MenuItem', name: 'Oxtail taco', offers: { '@type': 'Offer', price: '495.00', priceCurrency: 'DOP' } },
          { '@type': 'MenuItem', name: 'Quesadillas', offers: { '@type': 'Offer', price: '490.00', priceCurrency: 'DOP' } },
        ],
      },
    ]);
  });
});

describe('eventJsonLd', () => {
  it('turns a weekly night into dated events with Bávaro offsets', () => {
    const events = eventJsonLd(
      { id: 'rum', title: { en: 'Rum & Reggae' }, body: { en: 'Reggae' }, days: [0], start: '18:00', end: '22:00', active: true, price: 35_000, cta: 'book', itemIds: [], flyer: { bg: 'jungle', ink: 'gold' }, image: null },
      ['2026-10-25'],
      site,
      'https://mezcalitobarandgrill.com',
      'en',
    );
    expect(events[0]).toMatchObject({
      '@type': 'Event',
      name: 'Rum & Reggae',
      startDate: '2026-10-25T18:00:00-04:00',
      endDate: '2026-10-25T22:00:00-04:00',
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      offers: { price: '350.00', priceCurrency: 'DOP', url: 'https://mezcalitobarandgrill.com/en/reserve' },
    });
  });
  it('ends an overnight night on the next day', () => {
    const [e] = eventJsonLd(
      { id: 'late', title: { en: 'Late' }, body: undefined, days: [6], start: '22:00', end: '02:00', active: true, price: null, cta: 'none', itemIds: [], flyer: { bg: 'ink', ink: 'gold' }, image: null },
      ['2026-10-24'],
      site,
      'https://x.test',
      'en',
    );
    expect(e!.endDate).toBe('2026-10-25T02:00:00-04:00');
    expect(e).not.toHaveProperty('offers');
  });
});
