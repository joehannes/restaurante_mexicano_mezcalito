/**
 * Reads and writes behind the staff admin. Guests never reach these; every
 * caller has passed `guard` and every input has passed `domain/adminInput`.
 */
import type { ItemPatch, SeasonInput, SettingKey, SpecialInput } from '../domain/adminInput';
import { canMove, isOrderStatus, OPEN_STATUSES, type OrderStatus } from '../domain/orderStatus';
import type { Role } from '../domain/roles';
import type { OrderMode } from '../domain/types';
import { waitUntil } from 'cloudflare:workers';
import { notifyOrderStatus } from './notify';
import { tellKitchen } from './orders';

// ── Orders board ──────────────────────────────────────────────────────────

export interface BoardOrder {
  code: string;
  status: OrderStatus;
  mode: OrderMode;
  createdAt: string;
  scheduledFor: string | null;
  table: string | null;
  name: string;
  phone: string;
  address: { street?: string; reference?: string; lat?: number; lng?: number } | null;
  notes: string | null;
  payment: string;
  paymentStatus: string;
  total: number;
  locale: string;
  items: { itemId: string; variantId: string | null; qty: number; name: string; options: Record<string, string[]>; note: string | null; weightLb: number | null }[];
}

/** Open orders, plus those finished in the last half hour so a slip can be undone. */
export async function boardOrders(db: D1Database): Promise<BoardOrder[]> {
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const open = OPEN_STATUSES.map(() => '?').join(', ');
  const { results: orders } = await db
    .prepare(
      `SELECT * FROM orders o
       WHERE o.status IN (${open}) OR (SELECT MAX(at) FROM order_events e WHERE e.order_id = o.id) >= ?
       ORDER BY o.created_at`,
    )
    .bind(...OPEN_STATUSES, since)
    .all<Record<string, unknown>>();
  if (!orders.length) return [];
  const { results: items } = await db
    .prepare(
      `SELECT order_id, item_id, variant_id, qty, name, options, note, weight_lb FROM order_items
       WHERE order_id IN (${orders.map(() => '?').join(', ')}) ORDER BY order_id, line_no`,
    )
    .bind(...orders.map((o) => o.id))
    .all<Record<string, unknown>>();
  const lines = new Map<number, BoardOrder['items']>();
  for (const r of items) {
    const list = lines.get(Number(r.order_id)) ?? [];
    list.push({
      itemId: String(r.item_id),
      variantId: (r.variant_id as string | null) ?? null,
      qty: Number(r.qty),
      name: String(r.name),
      options: JSON.parse(String(r.options)),
      note: (r.note as string | null) ?? null,
      weightLb: (r.weight_lb as number | null) ?? null,
    });
    lines.set(Number(r.order_id), list);
  }
  return orders.map((o) => ({
    code: String(o.code),
    status: o.status as OrderStatus,
    mode: o.mode as OrderMode,
    createdAt: String(o.created_at),
    scheduledFor: (o.scheduled_for as string | null) ?? null,
    table: (o.table_label as string | null) ?? null,
    name: String(o.customer_name),
    phone: String(o.customer_phone),
    address: o.address ? JSON.parse(String(o.address)) : null,
    notes: (o.notes as string | null) ?? null,
    payment: String(o.payment_method),
    paymentStatus: String(o.payment_status),
    total: Number(o.total),
    locale: String(o.locale),
    items: lines.get(Number(o.id)) ?? [],
  }));
}

export type MoveResult = { ok: true; status: OrderStatus; mode: OrderMode } | { ok: false; error: 'not_found' | 'invalid_move' };

export async function moveOrder(env: Env, code: string, to: unknown, actor: string): Promise<MoveResult> {
  if (!isOrderStatus(to)) return { ok: false, error: 'invalid_move' };
  const order = await env.DB.prepare('SELECT id, mode, status FROM orders WHERE code = ?').bind(code).first<{ id: number; mode: OrderMode; status: OrderStatus }>();
  if (!order) return { ok: false, error: 'not_found' };
  if (!canMove(order.mode, order.status, to)) return { ok: false, error: 'invalid_move' };
  // Guarded by the old status, so two screens tapping at once cannot both win.
  const [update] = await env.DB.batch([
    env.DB.prepare('UPDATE orders SET status = ? WHERE id = ? AND status = ?').bind(to, order.id, order.status),
    env.DB.prepare('INSERT INTO order_events (order_id, status, actor) SELECT ?, ?, ? WHERE changes() > 0').bind(order.id, to, actor),
  ]);
  if (!update!.meta.changes) return { ok: false, error: 'invalid_move' };
  await Promise.all([
    tellKitchen(env, `order:${code}`, { status: to }),
    tellKitchen(env, 'board', { type: 'order.status', code, status: to }),
  ]);
  waitUntil(notifyOrderStatus(env, code, to));
  return { ok: true, status: to, mode: order.mode };
}

// ── Menu ──────────────────────────────────────────────────────────────────

const ITEM_COLUMNS: Record<keyof ItemPatch, string> = {
  categoryId: 'category_id',
  name: 'name',
  description: 'description',
  price: 'price',
  unit: 'unit',
  heat: 'heat',
  fusion: 'fusion',
  tags: 'tags',
  photo: 'photo',
  soldOut: 'sold_out',
  hidden: 'hidden',
};

const column = (value: unknown) =>
  value === null ? null : typeof value === 'boolean' ? Number(value) : typeof value === 'object' ? JSON.stringify(value) : value;

export async function updateItem(db: D1Database, id: string, patch: ItemPatch): Promise<boolean> {
  const entries = Object.entries(patch) as [keyof ItemPatch, unknown][];
  if (!entries.length) return true;
  const sets = entries.map(([k]) => `${ITEM_COLUMNS[k]} = ?`).join(', ');
  const result = await db
    .prepare(`UPDATE menu_items SET ${sets}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`)
    .bind(...entries.map(([, v]) => column(v)), id)
    .run();
  return result.meta.changes > 0;
}

export async function createItem(db: D1Database, id: string, patch: Required<Pick<ItemPatch, 'categoryId' | 'name' | 'price'>> & ItemPatch) {
  const position = await db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM menu_items').first<{ p: number }>();
  await db.prepare('INSERT INTO menu_items (id, category_id, name, price, position) VALUES (?, ?, ?, ?, ?)').bind(id, patch.categoryId, JSON.stringify(patch.name), patch.price, position!.p).run();
  const { categoryId: _c, name: _n, price: _p, ...rest } = patch;
  await updateItem(db, id, rest);
}

export async function setOptionSoldOut(db: D1Database, groupId: string, optionId: string, soldOut: boolean) {
  const r = await db.prepare('UPDATE modifier_options SET sold_out = ? WHERE group_id = ? AND id = ?').bind(Number(soldOut), groupId, optionId).run();
  return r.meta.changes > 0;
}

export async function updateVariant(db: D1Database, itemId: string, variantId: string, patch: { soldOut?: boolean; price?: number }) {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.soldOut !== undefined) sets.push('sold_out = ?') && values.push(Number(patch.soldOut));
  if (patch.price !== undefined) sets.push('price = ?') && values.push(patch.price);
  if (!sets.length) return true;
  const r = await db.prepare(`UPDATE item_variants SET ${sets.join(', ')} WHERE item_id = ? AND id = ?`).bind(...values, itemId, variantId).run();
  return r.meta.changes > 0;
}

export async function adminMenu(db: D1Database) {
  const [categories, groups, options] = await db.batch([
    db.prepare('SELECT id, name, hidden FROM categories ORDER BY position'),
    db.prepare('SELECT id, label, min, max FROM modifier_groups ORDER BY id'),
    db.prepare('SELECT group_id, id, label, price, sold_out FROM modifier_options ORDER BY group_id, position'),
  ]);
  return {
    categories: (categories!.results as Record<string, unknown>[]).map((c) => ({ id: String(c.id), name: JSON.parse(String(c.name)), hidden: !!c.hidden })),
    groups: (groups!.results as Record<string, unknown>[]).map((g) => ({
      id: String(g.id),
      label: JSON.parse(String(g.label)),
      options: (options!.results as Record<string, unknown>[])
        .filter((o) => o.group_id === g.id)
        .map((o) => ({ id: String(o.id), label: JSON.parse(String(o.label)), price: Number(o.price), soldOut: !!o.sold_out })),
    })),
  };
}

// ── Nights and offers ─────────────────────────────────────────────────────

export async function saveSpecial(db: D1Database, s: SpecialInput) {
  await db
    .prepare(
      `INSERT INTO specials (id, title, body, days, start_time, end_time, valid_from, valid_to, price, cta, item_ids, flyer, active, position)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, (SELECT COALESCE(MAX(position), 0) + 1 FROM specials))
       ON CONFLICT (id) DO UPDATE SET title = ?2, body = ?3, days = ?4, start_time = ?5, end_time = ?6, valid_from = ?7, valid_to = ?8,
         price = ?9, cta = ?10, item_ids = ?11, flyer = ?12, active = ?13, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(
      s.id,
      JSON.stringify(s.title),
      s.body ? JSON.stringify(s.body) : null,
      JSON.stringify(s.days),
      s.start,
      s.end,
      s.validFrom,
      s.validTo,
      s.price,
      s.cta,
      JSON.stringify(s.itemIds),
      JSON.stringify(s.flyer),
      Number(s.active),
    )
    .run();
}

export async function deleteSpecial(db: D1Database, id: string) {
  return (await db.prepare('DELETE FROM specials WHERE id = ?').bind(id).run()).meta.changes > 0;
}

/** Saves the line-up order: `ids` first to last. */
export async function orderSpecials(db: D1Database, ids: string[]) {
  await db.batch(ids.map((id, i) => db.prepare('UPDATE specials SET position = ? WHERE id = ?').bind(i, id)));
}

// ── Seasons ───────────────────────────────────────────────────────────────

export async function saveSeason(db: D1Database, s: SeasonInput) {
  await db
    .prepare(
      `INSERT INTO seasons (slug, name, starts_on, ends_on, priority, published, tokens, hero, blocks, playlist_url, og_image)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
       ON CONFLICT (slug) DO UPDATE SET name = ?2, starts_on = ?3, ends_on = ?4, priority = ?5, published = ?6, tokens = ?7, hero = ?8,
         blocks = ?9, playlist_url = ?10, og_image = ?11, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(
      s.slug,
      JSON.stringify(s.name),
      s.startsOn,
      s.endsOn,
      s.priority,
      Number(s.published),
      JSON.stringify(s.tokens),
      JSON.stringify(s.hero),
      JSON.stringify(s.blocks),
      s.playlistUrl,
      s.ogImage,
    )
    .run();
}

export async function deleteSeason(db: D1Database, slug: string) {
  return (await db.prepare('DELETE FROM seasons WHERE slug = ?').bind(slug).run()).meta.changes > 0;
}

// ── Reservations and party requests ───────────────────────────────────────

export const RESERVATION_STATUSES = ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'] as const;
export const PARTY_STATUSES = ['new', 'contacted', 'booked', 'declined'] as const;

export async function reservationsOn(db: D1Database, date: string) {
  const { results } = await db.prepare('SELECT * FROM reservations WHERE date = ? ORDER BY time, id').bind(date).all<Record<string, unknown>>();
  return results.map((r) => ({
    code: String(r.code),
    date: String(r.date),
    time: String(r.time),
    party: Number(r.party),
    status: String(r.status),
    name: String(r.name),
    phone: String(r.phone),
    email: (r.email as string | null) ?? null,
    occasion: (r.occasion as string | null) ?? null,
    seating: (r.seating as string | null) ?? null,
    addons: JSON.parse(String(r.addons)) as string[],
    notes: (r.notes as string | null) ?? null,
  }));
}

export async function setReservationStatus(db: D1Database, code: string, status: string) {
  if (!RESERVATION_STATUSES.includes(status as never)) return false;
  return (await db.prepare('UPDATE reservations SET status = ? WHERE code = ?').bind(status, code).run()).meta.changes > 0;
}

export async function partyRequests(db: D1Database) {
  const { results } = await db
    .prepare("SELECT * FROM party_requests WHERE status IN ('new', 'contacted') OR created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days') ORDER BY created_at DESC LIMIT 100")
    .all<Record<string, unknown>>();
  return results;
}

export async function setPartyStatus(db: D1Database, id: number, status: string) {
  if (!PARTY_STATUSES.includes(status as never)) return false;
  return (await db.prepare('UPDATE party_requests SET status = ? WHERE id = ?').bind(status, id).run()).meta.changes > 0;
}

// ── Settings and staff ────────────────────────────────────────────────────

export async function saveSetting(db: D1Database, key: SettingKey, value: unknown) {
  await db
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?1, ?2)
       ON CONFLICT (key) DO UPDATE SET value = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(key, JSON.stringify(value))
    .run();
}

export async function staffList(db: D1Database) {
  return (await db.prepare('SELECT email, name, role, created_at FROM staff ORDER BY role, email').all<{ email: string; name: string | null; role: Role }>()).results;
}

export async function saveStaff(db: D1Database, email: string, name: string | null, role: Role) {
  await db
    .prepare('INSERT INTO staff (email, name, role) VALUES (?1, ?2, ?3) ON CONFLICT (email) DO UPDATE SET name = ?2, role = ?3')
    .bind(email.toLowerCase(), name, role)
    .run();
}

export async function removeStaff(db: D1Database, email: string) {
  return (await db.prepare('DELETE FROM staff WHERE email = ?').bind(email.toLowerCase()).run()).meta.changes > 0;
}
