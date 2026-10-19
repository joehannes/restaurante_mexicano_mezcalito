/**
 * How the restaurant is doing online, from D1: orders and revenue by day,
 * the average ticket, covers booked, top dishes, how guests order and pay,
 * and what Radio listeners answer. Days are Bávaro days (UTC−4).
 */
import { addDays, localNow } from '../domain/schedule';

/** created_at is UTC ISO; Bávaro's day starts four hours later. */
const LOCAL_DAY = "substr(strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '-4 hours'), 1, 10)";
/** Orders that reached the kitchen. */
const COUNTED = "status NOT IN ('cancelled', 'awaiting_payment')";

export interface Insights {
  days: number;
  from: string;
  to: string;
  kpis: { orders: number; revenue: number; avgTicket: number; covers: number; parties: number };
  previous: { orders: number; revenue: number; avgTicket: number; covers: number; parties: number };
  daily: { date: string; orders: number; revenue: number }[];
  topItems: { itemId: string; name: string; qty: number; revenue: number }[];
  modes: Record<string, number>;
  payments: Record<string, number>;
  radio: { node: string; option: string; count: number }[];
}

async function totals(db: D1Database, from: string, to: string) {
  const [orders, covers, parties] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS revenue FROM orders WHERE ${COUNTED} AND ${LOCAL_DAY} BETWEEN ? AND ?`).bind(from, to),
    db.prepare("SELECT COALESCE(SUM(party), 0) AS covers FROM reservations WHERE status NOT IN ('cancelled', 'no_show') AND date BETWEEN ? AND ?").bind(from, to),
    db.prepare(`SELECT COUNT(*) AS n FROM party_requests WHERE ${LOCAL_DAY} BETWEEN ? AND ?`).bind(from, to),
  ]);
  const o = orders!.results[0] as { n: number; revenue: number };
  return {
    orders: o.n,
    revenue: o.revenue,
    avgTicket: o.n ? Math.round(o.revenue / o.n) : 0,
    covers: (covers!.results[0] as { covers: number }).covers,
    parties: (parties!.results[0] as { n: number }).n,
  };
}

export async function insights(env: Env, days: number, now = new Date()): Promise<Insights> {
  const to = localNow(now, env.TIMEZONE).date;
  const from = addDays(to, -(days - 1));
  const db = env.DB;
  const [kpis, previous, batch] = await Promise.all([
    totals(db, from, to),
    totals(db, addDays(from, -days), addDays(from, -1)),
    db.batch([
      db.prepare(`SELECT ${LOCAL_DAY} AS date, COUNT(*) AS orders, SUM(total) AS revenue FROM orders WHERE ${COUNTED} AND ${LOCAL_DAY} BETWEEN ? AND ? GROUP BY 1`).bind(from, to),
      db
        .prepare(
          `SELECT i.item_id, MAX(i.name) AS name, SUM(i.qty) AS qty, SUM(i.line_total) AS revenue FROM order_items i JOIN orders o ON o.id = i.order_id
           WHERE o.${COUNTED} AND substr(strftime('%Y-%m-%dT%H:%M:%fZ', o.created_at, '-4 hours'), 1, 10) BETWEEN ? AND ?
           GROUP BY i.item_id ORDER BY qty DESC, revenue DESC LIMIT 10`,
        )
        .bind(from, to),
      db.prepare(`SELECT mode AS k, COUNT(*) AS n FROM orders WHERE ${COUNTED} AND ${LOCAL_DAY} BETWEEN ? AND ? GROUP BY mode`).bind(from, to),
      db
        .prepare(
          `SELECT CASE WHEN payment_status = 'paid' THEN COALESCE(payment_provider, 'online') ELSE payment_method END AS k, COUNT(*) AS n
           FROM orders WHERE ${COUNTED} AND ${LOCAL_DAY} BETWEEN ? AND ? GROUP BY 1`,
        )
        .bind(from, to),
      db.prepare('SELECT node_id AS node, option_id AS option, count FROM radio_choices ORDER BY node_id, count DESC'),
    ]),
  ]);
  const [daily, top, modes, payments, radio] = batch.map((r) => r.results as Record<string, unknown>[]);
  const byDate = new Map(daily!.map((d) => [String(d.date), d]));
  return {
    days,
    from,
    to,
    kpis,
    previous,
    daily: Array.from({ length: days }, (_, i) => {
      const date = addDays(from, i);
      const d = byDate.get(date);
      return { date, orders: Number(d?.orders ?? 0), revenue: Number(d?.revenue ?? 0) };
    }),
    topItems: top!.map((t) => ({ itemId: String(t.item_id), name: String(t.name), qty: Number(t.qty), revenue: Number(t.revenue) })),
    modes: Object.fromEntries(modes!.map((m) => [String(m.k), Number(m.n)])),
    payments: Object.fromEntries(payments!.map((m) => [String(m.k), Number(m.n)])),
    radio: radio!.map((r) => ({ node: String(r.node), option: String(r.option), count: Number(r.count) })),
  };
}
