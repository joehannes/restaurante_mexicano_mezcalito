import { describe, expect, it } from 'vitest';
import { priceCart, findZone, toUsd } from './pricing';
import type { DeliveryZone, MenuItem, PricingSettings } from './types';

const settings: PricingSettings = {
  itbisRate: 0.18,
  serviceRate: { dine_in: 0.1, pickup: 0.1, delivery: 0.1 },
  usdRate: 63,
  weightStepLb: 0.5,
  minWeightLb: 1,
  maxQtyPerLine: 20,
};

const item = (overrides: Partial<MenuItem> & Pick<MenuItem, 'id'>): MenuItem => ({
  categoryId: 'mains',
  name: { en: overrides.id },
  price: 0,
  unit: 'each',
  heat: 0,
  fusion: 0,
  tags: [],
  soldOut: false,
  hidden: false,
  ...overrides,
});

const menu: MenuItem[] = [
  item({ id: 'oxtail', price: 179_900 }),
  item({
    id: 'rasta-pasta',
    price: 0,
    variants: [
      { id: 'chicken', label: { en: 'Chicken' }, price: 119_900 },
      { id: 'oxtail', label: { en: 'Oxtail' }, price: 159_500 },
      { id: 'lobster', label: { en: 'Lobster' }, price: 199_500, soldOut: true },
    ],
  }),
  item({
    id: 'nachos',
    price: 49_900,
    modifierGroups: [
      {
        id: 'protein',
        label: { en: 'Add protein' },
        min: 0,
        max: 2,
        options: [
          { id: 'chicken', label: { en: 'Chicken' }, price: 14_000 },
          { id: 'shrimp', label: { en: 'Shrimp' }, price: 16_000 },
          { id: 'beef', label: { en: 'Beef' }, price: 17_000 },
        ],
      },
    ],
  }),
  item({
    id: 'jerk-chicken',
    price: 119_900,
    modifierGroups: [
      {
        id: 'side',
        label: { en: 'Side' },
        min: 1,
        max: 1,
        options: [
          { id: 'rice-peas', label: { en: 'Rice & peas' }, price: 0 },
          { id: 'festival', label: { en: 'Festival' }, price: 0 },
          { id: 'mac', label: { en: 'Mac & cheese' }, price: 0, soldOut: true },
        ],
      },
    ],
  }),
  item({ id: 'lobster', unit: 'lb', price: 198_500 }),
  item({ id: 'ackee-tostones', price: 48_500, soldOut: true }),
  item({ id: 'secret', price: 10_000, hidden: true }),
];

describe('priceCart', () => {
  it('prices plain items and adds ITBIS and service on the subtotal, not on each other', () => {
    const result = priceCart(menu, [{ itemId: 'oxtail', qty: 2 }], settings, 'dine_in');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.subtotal).toBe(359_800);
    expect(result.itbis).toBe(64_764); // 18% of 3,598.00
    expect(result.service).toBe(35_980); // 10% of 3,598.00
    expect(result.deliveryFee).toBe(0);
    expect(result.total).toBe(359_800 + 64_764 + 35_980);
  });

  it('uses the variant price and rejects a sold-out variant', () => {
    const ok = priceCart(menu, [{ itemId: 'rasta-pasta', variantId: 'oxtail', qty: 1 }], settings, 'pickup');
    expect(ok.ok && ok.subtotal).toBe(159_500);

    const sold = priceCart(menu, [{ itemId: 'rasta-pasta', variantId: 'lobster', qty: 1 }], settings, 'pickup');
    expect(sold.ok).toBe(false);
    if (sold.ok) return;
    expect(sold.errors).toEqual([{ line: 0, code: 'variant_sold_out' }]);
  });

  it('requires a variant when the item has variants', () => {
    const r = priceCart(menu, [{ itemId: 'rasta-pasta', qty: 1 }], settings, 'pickup');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('variant_required');
  });

  it('adds modifier prices once per unit', () => {
    const r = priceCart(
      menu,
      [{ itemId: 'nachos', qty: 2, options: { protein: ['chicken', 'shrimp'] } }],
      settings,
      'pickup',
    );
    expect(r.ok && r.subtotal).toBe(2 * (49_900 + 14_000 + 16_000));
  });

  it('enforces modifier min and max, unknown options and sold-out options', () => {
    const tooMany = priceCart(
      menu,
      [{ itemId: 'nachos', qty: 1, options: { protein: ['chicken', 'shrimp', 'beef'] } }],
      settings,
      'pickup',
    );
    expect(!tooMany.ok && tooMany.errors[0]?.code).toBe('too_many_options');

    const missing = priceCart(menu, [{ itemId: 'jerk-chicken', qty: 1 }], settings, 'pickup');
    expect(!missing.ok && missing.errors[0]?.code).toBe('option_required');

    const unknown = priceCart(
      menu,
      [{ itemId: 'jerk-chicken', qty: 1, options: { side: ['fries'] } }],
      settings,
      'pickup',
    );
    expect(!unknown.ok && unknown.errors[0]?.code).toBe('unknown_option');

    const soldOut = priceCart(
      menu,
      [{ itemId: 'jerk-chicken', qty: 1, options: { side: ['mac'] } }],
      settings,
      'pickup',
    );
    expect(!soldOut.ok && soldOut.errors[0]?.code).toBe('option_sold_out');

    const strayGroup = priceCart(
      menu,
      [{ itemId: 'jerk-chicken', qty: 1, options: { side: ['festival'], sauce: ['x'] } }],
      settings,
      'pickup',
    );
    expect(!strayGroup.ok && strayGroup.errors[0]?.code).toBe('unknown_option');
  });

  it('ignores a duplicated option id rather than charging twice', () => {
    const r = priceCart(
      menu,
      [{ itemId: 'nachos', qty: 1, options: { protein: ['shrimp', 'shrimp'] } }],
      settings,
      'pickup',
    );
    expect(r.ok && r.subtotal).toBe(49_900 + 16_000);
  });

  it('prices items sold by the pound by weight, in steps, with a minimum', () => {
    const r = priceCart(menu, [{ itemId: 'lobster', qty: 1, weightLb: 1.5 }], settings, 'dine_in');
    expect(r.ok && r.subtotal).toBe(297_750);

    const offStep = priceCart(menu, [{ itemId: 'lobster', qty: 1, weightLb: 1.3 }], settings, 'dine_in');
    expect(!offStep.ok && offStep.errors[0]?.code).toBe('invalid_weight');

    const tooLight = priceCart(menu, [{ itemId: 'lobster', qty: 1, weightLb: 0.5 }], settings, 'dine_in');
    expect(!tooLight.ok && tooLight.errors[0]?.code).toBe('invalid_weight');

    const noWeight = priceCart(menu, [{ itemId: 'lobster', qty: 1 }], settings, 'dine_in');
    expect(!noWeight.ok && noWeight.errors[0]?.code).toBe('invalid_weight');
  });

  it('rejects unknown, hidden and sold-out items and bad quantities, reporting every bad line', () => {
    const r = priceCart(
      menu,
      [
        { itemId: 'nope', qty: 1 },
        { itemId: 'ackee-tostones', qty: 1 },
        { itemId: 'secret', qty: 1 },
        { itemId: 'oxtail', qty: 0 },
        { itemId: 'oxtail', qty: 1.5 },
        { itemId: 'oxtail', qty: 21 },
      ],
      settings,
      'pickup',
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual([
      { line: 0, code: 'unknown_item' },
      { line: 1, code: 'sold_out' },
      { line: 2, code: 'unknown_item' },
      { line: 3, code: 'invalid_qty' },
      { line: 4, code: 'invalid_qty' },
      { line: 5, code: 'invalid_qty' },
    ]);
  });

  it('rejects an empty cart', () => {
    const r = priceCart(menu, [], settings, 'pickup');
    expect(!r.ok && r.errors[0]?.code).toBe('empty_cart');
  });

  it('applies the service rate of the order mode', () => {
    const noService = { ...settings, serviceRate: { ...settings.serviceRate, pickup: 0 } };
    const r = priceCart(menu, [{ itemId: 'oxtail', qty: 1 }], noService, 'pickup');
    expect(r.ok && r.service).toBe(0);
  });

  it('adds the delivery fee untaxed and enforces the zone minimum', () => {
    const zone: DeliveryZone = { id: 'z', name: 'Bávaro', polygon: [], fee: 15_000, minOrder: 100_000 };
    const r = priceCart(menu, [{ itemId: 'oxtail', qty: 1 }], settings, 'delivery', zone);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.deliveryFee).toBe(15_000);
    expect(r.total).toBe(179_900 + 32_382 + 17_990 + 15_000);

    const small = priceCart(menu, [{ itemId: 'nachos', qty: 1 }], settings, 'delivery', zone);
    expect(!small.ok && small.errors[0]?.code).toBe('below_minimum');

    const noZone = priceCart(menu, [{ itemId: 'oxtail', qty: 1 }], settings, 'delivery');
    expect(!noZone.ok && noZone.errors[0]?.code).toBe('outside_delivery_zone');
  });

  it('returns priced lines the receipt can show', () => {
    const r = priceCart(
      menu,
      [{ itemId: 'nachos', qty: 3, options: { protein: ['beef'] }, note: ' no onions ' }],
      settings,
      'pickup',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines).toEqual([
      {
        itemId: 'nachos',
        variantId: undefined,
        qty: 3,
        weightLb: undefined,
        options: { protein: ['beef'] },
        note: 'no onions',
        unitPrice: 66_900,
        lineTotal: 200_700,
      },
    ]);
  });
});

describe('findZone', () => {
  const square: DeliveryZone = {
    id: 'square',
    name: 'Square',
    polygon: [
      [-68.44, 18.68],
      [-68.41, 18.68],
      [-68.41, 18.71],
      [-68.44, 18.71],
    ],
    fee: 10_000,
    minOrder: 0,
  };
  const outer: DeliveryZone = { ...square, id: 'outer', polygon: [[-68.5, 18.6], [-68.3, 18.6], [-68.3, 18.8], [-68.5, 18.8]] };

  it('finds the first zone containing the point, in the given order', () => {
    expect(findZone({ lng: -68.426, lat: 18.692 }, [square, outer])?.id).toBe('square');
    expect(findZone({ lng: -68.35, lat: 18.75 }, [square, outer])?.id).toBe('outer');
  });

  it('returns undefined outside every zone', () => {
    expect(findZone({ lng: -70.0, lat: 18.5 }, [square, outer])).toBeUndefined();
  });
});

describe('toUsd', () => {
  it('converts and rounds to whole cents', () => {
    expect(toUsd(630_000, 63)).toBe(10_000);
    expect(toUsd(100, 63)).toBe(2);
  });
});
