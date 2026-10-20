import { describe, expect, it } from 'vitest';
import { settings, specials } from '../../seed/data';
import { parseChoices, parseCredentials, parseEvent, parseGallery, parseGroup, parseItemPatch, parseLocalized, parseSeason, parseSetting, parseSpecial } from './adminInput';
import { draftFromPreset, PRESETS } from './seasonPresets';

describe('parseLocalized', () => {
  it('needs English and drops empty translations', () => {
    expect(parseLocalized({ en: ' Oxtail ', es: 'Rabo', fr: '' })).toEqual({ en: 'Oxtail', es: 'Rabo' });
    expect(parseLocalized({ es: 'Rabo' })).toBeUndefined();
    expect(parseLocalized('Oxtail')).toBeUndefined();
  });
});

describe('parseItemPatch', () => {
  it('keeps only the fields sent', () => {
    expect(parseItemPatch({ soldOut: true })).toEqual({ ok: true, value: { soldOut: true } });
    expect(parseItemPatch({ price: 179_900, heat: 3, tags: ['signature', 'signature'] })).toEqual({
      ok: true,
      value: { price: 179_900, heat: 3, tags: ['signature'] },
    });
  });
  it('clears a description or photo with null', () => {
    expect(parseItemPatch({ description: null, photo: '' })).toEqual({ ok: true, value: { description: null, photo: null } });
  });
  it('reports every bad field', () => {
    const r = parseItemPatch({ price: -1, heat: 9, fusion: 0.5, tags: ['Bad Tag'], photo: 'https://evil.example/x.png', name: {} });
    expect(r).toEqual({ ok: false, errors: ['name', 'price', 'heat', 'fusion', 'tags', 'photo'] });
  });
});

describe('parseSpecial', () => {
  const taco = {
    id: 'taco-tuesday',
    title: { en: 'Taco Tuesday' },
    days: [2],
    start: '08:00',
    end: '24:00',
    price: 19_900,
    cta: 'order',
    flyer: { bg: 'hibiscus', ink: 'cream', sticker: 'RD$199' },
  };
  it('accepts a night and fills in defaults', () => {
    expect(parseSpecial(taco)).toEqual({
      ok: true,
      value: { ...taco, body: null, validFrom: null, validTo: null, itemIds: [], image: null, active: true },
    });
  });
  it('accepts every seeded night', () => {
    for (const s of specials) expect(parseSpecial(s).ok, s.id).toBe(true);
  });
  it('takes a photo from the uploads or the site’s own, nothing else', () => {
    expect(parseSpecial({ ...taco, image: '/img/nights/taco-tuesday.webp' })).toMatchObject({ ok: true, value: { image: '/img/nights/taco-tuesday.webp' } });
    expect(parseSpecial({ ...taco, image: 'https://evil.example/x.jpg' })).toEqual({ ok: false, errors: ['image'] });
  });
  it('rejects unreadable flyers, bad times and inverted date ranges', () => {
    const r = parseSpecial({ ...taco, start: '24:00', flyer: { bg: 'gold', ink: 'gold' }, validFrom: '2026-12-01', validTo: '2026-11-01' });
    expect(r).toEqual({ ok: false, errors: ['start', 'validTo', 'flyer'] });
  });
});

describe('parseSetting', () => {
  it('accepts every seeded setting as it stands', () => {
    for (const [key, value] of Object.entries(settings)) expect(parseSetting(key, value).ok, key).toBe(true);
  });
  it('rejects unknown keys and broken values', () => {
    expect(parseSetting('paymentSecret', 'x').ok).toBe(false);
    expect(parseSetting('hours', [[{ open: '08:00', close: '24:00' }]]).ok).toBe(false);
    expect(parseSetting('pricing', { ...settings.pricing, itbisRate: 18 }).ok).toBe(false);
    expect(parseSetting('contact', { ...settings.contact, email: 'nope' }).ok).toBe(false);
    expect(parseSetting('social', { instagram: 'javascript:alert(1)' }).ok).toBe(false);
  });
  it('normalises contact numbers', () => {
    const r = parseSetting('contact', { phone: '809-959-1646', whatsapp: '(809) 212-0782', email: 'info@example.com' });
    expect(r).toEqual({ ok: true, value: { phone: '+18099591646', whatsapp: '+18092120782', email: 'info@example.com', confirmed: false } });
  });
  it('checks delivery zones as polygons with fees', () => {
    const zone = { id: 'cortecito', name: 'El Cortecito', fee: 15_000, minOrder: 50_000, polygon: [[-68.43, 18.69], [-68.42, 18.69], [-68.42, 18.70]] };
    expect(parseSetting('deliveryZones', [zone]).ok).toBe(true);
    expect(parseSetting('deliveryZones', [{ ...zone, polygon: [[0, 0]] }]).ok).toBe(false);
  });
});

describe('parseSeason', () => {
  const draft = draftFromPreset('dia-de-muertos', '2026-10-18')!;
  it('accepts every preset as a draft', () => {
    for (const p of PRESETS) expect(parseSeason({ ...draftFromPreset(p.slug, '2026-10-18'), published: false }).ok, p.slug).toBe(true);
  });
  it('keeps only palette colours as hex', () => {
    expect(parseSeason({ ...draft, tokens: { '--c-gold': '#F59F0B' } })).toMatchObject({ ok: true, value: { tokens: { '--c-gold': '#f59f0b' } } });
    expect(parseSeason({ ...draft, tokens: { '--c-gold': 'red;}body{display:none' } })).toMatchObject({ ok: false, errors: ['tokens'] });
    expect(parseSeason({ ...draft, tokens: { '--font-display': '#000000' } })).toMatchObject({ ok: false, errors: ['tokens'] });
  });
  it('rejects inverted dates, unknown blocks and outside images', () => {
    const r = parseSeason({ ...draft, endsOn: '2026-01-01', blocks: [{ type: 'iframe', src: 'x' }], ogImage: 'https://evil.example/og.png' });
    expect(r).toEqual({ ok: false, errors: ['endsOn', 'blocks', 'ogImage'] });
  });
});

describe('parseChoices', () => {
  it('keeps known ids and checks labels and prices', () => {
    expect(parseChoices([{ id: 'chicken', label: { en: 'Chicken' }, price: 119_900 }, { label: { en: 'Goat' }, price: 149_500 }])).toEqual({
      ok: true,
      value: [{ id: 'chicken', label: { en: 'Chicken' }, price: 119_900 }, { label: { en: 'Goat' }, price: 149_500 }],
    });
    expect(parseChoices([{ label: { en: 'Free' }, price: -1 }]).ok).toBe(false);
    expect(parseChoices([{ label: {}, price: 0 }]).ok).toBe(false);
  });
});

describe('parseGroup', () => {
  it('needs a name and a sane pick range', () => {
    expect(parseGroup({ label: { en: 'Side' }, min: 1, max: 1, options: [] }).ok).toBe(true);
    expect(parseGroup({ label: { en: 'Side' }, min: 2, max: 1, options: [] })).toEqual({ ok: false, errors: ['max'] });
  });
});

describe('parseGallery', () => {
  it('takes site photos, uploads and clips', () => {
    const photo = parseGallery({ kind: 'photo', src: '/img/polaroids/sip.webp', caption: { en: 'Sip' }, tilt: 4.25 });
    expect(photo).toEqual({ ok: true, value: { kind: 'photo', src: '/img/polaroids/sip.webp', poster: null, caption: { en: 'Sip' }, tilt: 4.3, onHome: true, published: true } });
    expect(parseGallery({ kind: 'video', src: '/media/gallery/a.mp4', poster: '/media/gallery/a.webp', caption: { en: 'Go' }, tilt: 0 }).ok).toBe(true);
  });
  it('refuses other places, a photo as video and wild tilts', () => {
    expect(parseGallery({ kind: 'photo', src: 'https://evil.example/x.jpg', caption: { en: 'x' }, tilt: 0 })).toEqual({ ok: false, errors: ['src'] });
    expect(parseGallery({ kind: 'video', src: '/media/gallery/a.webp', caption: { en: 'x' }, tilt: 0 })).toEqual({ ok: false, errors: ['src'] });
    expect(parseGallery({ kind: 'photo', src: '/img/a.webp', caption: { en: 'x' }, tilt: 40 })).toEqual({ ok: false, errors: ['tilt'] });
  });
});

describe('parseEvent', () => {
  const base = { slug: 'noche', title: { en: 'Noche' }, startsOn: '2026-10-31', endsOn: '2026-11-02', cta: 'book', color: 'sunset', highlights: [] };
  it('accepts a full event', () => {
    const r = parseEvent({ ...base, startTime: '18:00', endTime: '24:00', price: 99_900, highlights: [{ en: 'Karaoke' }], published: true });
    expect(r.ok && r.value).toMatchObject({ slug: 'noche', startTime: '18:00', endTime: '24:00', price: 99_900, highlights: [{ en: 'Karaoke' }], published: true, kicker: null });
  });
  it('needs dates in order, a link for a link button, and a palette colour', () => {
    expect(parseEvent({ ...base, endsOn: '2026-10-01' })).toEqual({ ok: false, errors: ['endsOn'] });
    expect(parseEvent({ ...base, cta: 'link' })).toEqual({ ok: false, errors: ['ctaUrl'] });
    expect(parseEvent({ ...base, cta: 'link', ctaUrl: 'http://insecure.example' })).toEqual({ ok: false, errors: ['ctaUrl'] });
    expect(parseEvent({ ...base, color: 'cream' })).toEqual({ ok: false, errors: ['color'] });
  });
});

describe('parseCredentials', () => {
  const stored = { azul: { merchantId: '39038540035', merchantName: 'Mezcalito', merchantType: 'Restaurant', authKey: 'old-key', mode: 'test' as const } };
  it('keeps a saved secret left blank', () => {
    const r = parseCredentials({ azul: { merchantId: '39038540035', authKey: '', mode: 'live' } }, stored);
    expect(r.ok && r.value.azul).toMatchObject({ authKey: 'old-key', mode: 'live' });
  });
  it('clears a provider and refuses a missing secret', () => {
    expect(parseCredentials({ azul: { clear: true } }, stored)).toEqual({ ok: true, value: {} });
    expect(parseCredentials({ paypal: { clientId: 'AbCdEfGhIjKlMn', secret: '' } }, {})).toEqual({ ok: false, errors: ['paypal.secret'] });
  });
});

describe('payments setting', () => {
  it('defaults every way to pay on, and never leaves none', () => {
    expect(parseSetting('payments', {})).toEqual({ ok: true, value: { cash: true, cardOnDelivery: true, azul: true, paypal: true, note: null } });
    const off = parseSetting('payments', { cash: false, cardOnDelivery: false, azul: false, paypal: false });
    expect(off.ok && (off.value as { cash: boolean }).cash).toBe(true);
  });
});
