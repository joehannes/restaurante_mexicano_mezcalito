/**
 * What an order costs.
 *
 * The same function prices the cart in the guest's browser and again on the
 * server before an order is stored, so the number on the receipt is the one
 * the guest saw. The server never trusts a price sent by the client: it only
 * accepts ids, quantities and choices, and looks the prices up itself.
 *
 * ITBIS (18%) and the legal service charge (10%) are both levied on the food
 * and drink subtotal — never one on top of the other. The delivery fee is
 * added afterwards, untaxed.
 */
import type { CartLine, Centavos, DeliveryZone, MenuItem, OrderMode, PricingSettings } from './types';

export type PricingErrorCode =
  | 'empty_cart'
  | 'unknown_item'
  | 'sold_out'
  | 'invalid_qty'
  | 'variant_required'
  | 'unknown_variant'
  | 'variant_sold_out'
  | 'unknown_option'
  | 'option_sold_out'
  | 'option_required'
  | 'too_many_options'
  | 'invalid_weight'
  | 'outside_delivery_zone'
  | 'below_minimum';

export interface PricingError {
  /** Index of the offending cart line, or −1 for the order as a whole. */
  line: number;
  code: PricingErrorCode;
}

export interface PricedLine {
  itemId: string;
  variantId: string | undefined;
  qty: number;
  weightLb: number | undefined;
  options: Record<string, string[]>;
  note: string | undefined;
  /** One unit, with its options (and weight, for items sold by the pound). */
  unitPrice: Centavos;
  lineTotal: Centavos;
}

export type PricedCart =
  | {
      ok: true;
      lines: PricedLine[];
      subtotal: Centavos;
      itbis: Centavos;
      service: Centavos;
      deliveryFee: Centavos;
      total: Centavos;
    }
  | { ok: false; errors: PricingError[] };

const isStep = (value: number, step: number) => Math.abs(value / step - Math.round(value / step)) < 1e-9;

function priceLine(
  line: CartLine,
  item: MenuItem | undefined,
  settings: PricingSettings,
): { error: PricingErrorCode } | { unitPrice: Centavos; options: Record<string, string[]> } {
  if (!item || item.hidden) return { error: 'unknown_item' };
  if (item.soldOut) return { error: 'sold_out' };
  if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > settings.maxQtyPerLine) {
    return { error: 'invalid_qty' };
  }

  let base = item.price;
  if (item.variants?.length) {
    if (!line.variantId) return { error: 'variant_required' };
    const variant = item.variants.find((v) => v.id === line.variantId);
    if (!variant) return { error: 'unknown_variant' };
    if (variant.soldOut) return { error: 'variant_sold_out' };
    base = variant.price;
  } else if (line.variantId) {
    return { error: 'unknown_variant' };
  }

  const groups = item.modifierGroups ?? [];
  const chosen = line.options ?? {};
  if (Object.keys(chosen).some((groupId) => !groups.some((g) => g.id === groupId))) {
    return { error: 'unknown_option' };
  }

  let extras = 0;
  const options: Record<string, string[]> = {};
  for (const group of groups) {
    const ids = [...new Set(chosen[group.id] ?? [])];
    for (const id of ids) {
      const option = group.options.find((o) => o.id === id);
      if (!option) return { error: 'unknown_option' };
      if (option.soldOut) return { error: 'option_sold_out' };
      extras += option.price;
    }
    if (ids.length < group.min) return { error: 'option_required' };
    if (ids.length > group.max) return { error: 'too_many_options' };
    if (ids.length) options[group.id] = ids;
  }

  if (item.unit === 'lb') {
    const w = line.weightLb;
    if (w === undefined || !(w >= settings.minWeightLb) || !isStep(w, settings.weightStepLb)) {
      return { error: 'invalid_weight' };
    }
    return { unitPrice: Math.round(base * w) + extras, options };
  }
  return { unitPrice: base + extras, options };
}

export function priceCart(
  menu: readonly MenuItem[],
  cart: readonly CartLine[],
  settings: PricingSettings,
  mode: OrderMode,
  zone?: DeliveryZone,
): PricedCart {
  if (!cart.length) return { ok: false, errors: [{ line: -1, code: 'empty_cart' }] };

  const byId = new Map(menu.map((item) => [item.id, item]));
  const errors: PricingError[] = [];
  const lines: PricedLine[] = [];

  cart.forEach((line, index) => {
    const priced = priceLine(line, byId.get(line.itemId), settings);
    if ('error' in priced) {
      errors.push({ line: index, code: priced.error });
      return;
    }
    const note = line.note?.trim();
    lines.push({
      itemId: line.itemId,
      variantId: line.variantId,
      qty: line.qty,
      weightLb: line.weightLb,
      options: priced.options,
      note: note ? note : undefined,
      unitPrice: priced.unitPrice,
      lineTotal: priced.unitPrice * line.qty,
    });
  });
  if (errors.length) return { ok: false, errors };

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  let deliveryFee = 0;
  if (mode === 'delivery') {
    if (!zone) return { ok: false, errors: [{ line: -1, code: 'outside_delivery_zone' }] };
    if (subtotal < zone.minOrder) return { ok: false, errors: [{ line: -1, code: 'below_minimum' }] };
    deliveryFee = zone.fee;
  }

  const itbis = Math.round(subtotal * settings.itbisRate);
  const service = Math.round(subtotal * settings.serviceRate[mode]);
  return { ok: true, lines, subtotal, itbis, service, deliveryFee, total: subtotal + itbis + service + deliveryFee };
}

/** Ray casting; the ring may be given open or closed. */
function inPolygon(lng: number, lat: number, ring: readonly [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The first zone, in staff-chosen order, that contains the point. */
export const findZone = (point: { lng: number; lat: number }, zones: readonly DeliveryZone[]) =>
  zones.find((zone) => inPolygon(point.lng, point.lat, zone.polygon));

/** A guest-facing estimate in US cents. Never charged. */
export const toUsd = (amount: Centavos, pesosPerDollar: number): number => Math.round(amount / pesosPerDollar);
