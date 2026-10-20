/**
 * Placing an order: validate, price on the server, check the kitchen can take
 * it, store it, and tell the kitchen screen.
 */
import { findZone, priceCart } from '../domain/pricing';
import { openStatus, orderSlots } from '../domain/schedule';
import { orderCode, type OrderInput } from '../domain/orderInput';
import { localized } from '../domain/types';
import { waitUntil } from 'cloudflare:workers';
import { loadSite } from './content';
import { loadMenu } from './menu';
import { notifyOrderPlaced } from './notify';
import { onlineProviders, paymentChoices } from './payments';

export type PlaceOrderError =
  | 'closed'
  | 'slot_unavailable'
  | 'outside_delivery_zone'
  | 'online_unavailable'
  | 'payment_unavailable'
  | 'pricing'
  | 'storage';

export type PlaceOrderResult =
  | { ok: true; code: string; key: string; total: number }
  | { ok: false; error: PlaceOrderError; detail?: unknown };

const randomKey = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!);
};

export async function placeOrder(env: Env, input: OrderInput, now = new Date()): Promise<PlaceOrderResult> {
  const [menu, { site }] = await Promise.all([loadMenu(env.DB), loadSite(env.DB)]);
  const tz = env.TIMEZONE;

  const online = input.payment === 'online';
  // Cash and card on delivery can be switched off under Admin → Settings → Payments.
  const [choices, providers] = await Promise.all([paymentChoices(env), onlineProviders(env)]);
  const cashOff = choices.cash === false && (choices.cardOnDelivery !== false || providers.length > 0);
  if ((input.payment === 'cash' && cashOff) || (input.payment === 'card_on_delivery' && choices.cardOnDelivery === false)) {
    return { ok: false, error: 'payment_unavailable' };
  }
  if (online && !providers.length) return { ok: false, error: 'online_unavailable' };

  if (input.when === 'asap') {
    if (!openStatus(now, site.hours, site.closures, tz).open) return { ok: false, error: 'closed' };
  } else if (!orderSlots(now, site.hours, site.closures, tz).includes(input.when)) {
    return { ok: false, error: 'slot_unavailable' };
  }

  let zone;
  if (input.mode === 'delivery') {
    const { lat, lng } = input.address ?? {};
    zone = lat !== undefined && lng !== undefined ? findZone({ lat, lng }, site.deliveryZones ?? []) : undefined;
    if (!zone) return { ok: false, error: 'outside_delivery_zone' };
  }

  const priced = priceCart(menu, input.lines, site.pricing, input.mode, zone);
  if (!priced.ok) return { ok: false, error: 'pricing', detail: priced.errors };

  const byId = new Map(menu.map((i) => [i.id, i]));
  const key = randomKey();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = orderCode();
    const orderId = '(SELECT id FROM orders WHERE code = ?1)';
    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO orders (code, access_key, mode, status, payment_method, customer_name, customer_phone, customer_email,
             address, zone_id, table_label, scheduled_for, locale, notes, subtotal, itbis, service, delivery_fee, total, payment_status)
           VALUES (?1, ?2, ?3, ?19, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?20)`,
        ).bind(
          code,
          key,
          input.mode,
          input.payment,
          input.name,
          input.phone,
          input.email ?? null,
          input.address ? JSON.stringify(input.address) : null,
          zone?.id ?? null,
          input.table ?? null,
          input.when === 'asap' ? null : input.when,
          input.locale,
          input.notes ?? null,
          priced.subtotal,
          priced.itbis,
          priced.service,
          priced.deliveryFee,
          priced.total,
          online ? 'awaiting_payment' : 'received',
          online ? 'pending' : 'unpaid',
        ),
        ...priced.lines.map((line, i) =>
          env.DB.prepare(
            `INSERT INTO order_items (order_id, line_no, item_id, variant_id, qty, weight_lb, options, note, name, unit_price, line_total)
             VALUES (${orderId}, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
          ).bind(
            code,
            i + 1,
            line.itemId,
            line.variantId ?? null,
            line.qty,
            line.weightLb ?? null,
            JSON.stringify(line.options),
            line.note ?? null,
            JSON.stringify(byId.get(line.itemId)!.name),
            line.unitPrice,
            line.lineTotal,
          ),
        ),
        env.DB.prepare(`INSERT INTO order_events (order_id, status, actor) VALUES (${orderId}, ?2, 'guest')`).bind(code, online ? 'awaiting_payment' : 'received'),
      ]);
    } catch (error) {
      if (String(error).includes('UNIQUE') && String(error).includes('code')) continue;
      return { ok: false, error: 'storage', detail: String(error) };
    }

    // An order paid online reaches the kitchen once the payment is confirmed.
    if (online) return { ok: true, code, key, total: priced.total };
    const item = (id: string) => byId.get(id);
    waitUntil(notifyOrderPlaced(env, code));
    await tellKitchen(env, 'board', {
      type: 'order.created',
      code,
      mode: input.mode,
      table: input.table,
      when: input.when,
      total: priced.total,
      items: priced.lines.map((l) => ({ qty: l.qty, name: localized(item(l.itemId)!.name, 'en'), options: l.options, note: l.note })),
    });
    return { ok: true, code, key, total: priced.total };
  }
  return { ok: false, error: 'storage', detail: 'no free order code' };
}

/** Best effort: a screen that is offline catches up from D1 when it reconnects. */
export async function tellKitchen(env: Env, tag: string, data: unknown) {
  try {
    const room = env.KITCHEN.get(env.KITCHEN.idFromName('kitchen'));
    await room.fetch('https://kitchen/broadcast', { method: 'POST', body: JSON.stringify({ tag, data }) });
  } catch {
    // Never fail an order because a screen could not be told.
  }
}

export interface OrderView {
  code: string;
  status: string;
  mode: string;
  createdAt: string;
  scheduledFor: string | null;
  table: string | null;
  total: number;
  subtotal: number;
  itbis: number;
  service: number;
  deliveryFee: number;
  payment: string;
  paymentStatus: string;
  /** Only with the right access key. */
  customerName?: string;
  items?: { qty: number; name: string; options: Record<string, string[]>; note: string | null; lineTotal: number }[];
}

export async function loadOrder(db: D1Database, code: string, key?: string | null): Promise<OrderView | undefined> {
  const order = await db.prepare('SELECT * FROM orders WHERE code = ?').bind(code).first<Record<string, unknown>>();
  if (!order) return undefined;
  const view: OrderView = {
    code: String(order.code),
    status: String(order.status),
    mode: String(order.mode),
    createdAt: String(order.created_at),
    scheduledFor: (order.scheduled_for as string | null) ?? null,
    table: (order.table_label as string | null) ?? null,
    total: Number(order.total),
    subtotal: Number(order.subtotal),
    itbis: Number(order.itbis),
    service: Number(order.service),
    deliveryFee: Number(order.delivery_fee),
    payment: String(order.payment_method),
    paymentStatus: String(order.payment_status),
  };
  if (!key || key !== order.access_key) return view;
  const { results } = await db
    .prepare('SELECT qty, name, options, note, line_total FROM order_items WHERE order_id = ? ORDER BY line_no')
    .bind(order.id)
    .all<Record<string, unknown>>();
  return {
    ...view,
    customerName: String(order.customer_name).split(/\s+/)[0],
    items: results.map((r) => ({
      qty: Number(r.qty),
      name: String(r.name),
      options: JSON.parse(String(r.options)),
      note: (r.note as string | null) ?? null,
      lineTotal: Number(r.line_total),
    })),
  };
}
