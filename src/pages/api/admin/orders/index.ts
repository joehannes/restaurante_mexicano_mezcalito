import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { localNow } from '../../../../domain/schedule';
import type { Localized } from '../../../../domain/types';
import { guard, json } from '../../../../server/admin';
import { loadMenu } from '../../../../server/menu';
import { boardOrders, reservationsOn } from '../../../../server/staffData';

/** Everything the board shows: open orders, today's bookings and new party requests. */
export const GET: APIRoute = async ({ locals }) => {
  const staff = guard(locals, 'orders');
  if (staff instanceof Response) return staff;
  const today = localNow(new Date(), env.TIMEZONE).date;
  const [orders, bookings, parties, menu] = await Promise.all([
    boardOrders(env.DB),
    reservationsOn(env.DB, today),
    env.DB.prepare("SELECT COUNT(*) AS n FROM party_requests WHERE status = 'new'").first<{ n: number }>(),
    loadMenu(env.DB),
  ]);
  // What the option and variant ids on each ticket mean, for the cooks.
  const options: Record<string, Record<string, Localized>> = {};
  const variants: Record<string, Record<string, Localized>> = {};
  for (const item of menu) {
    for (const v of item.variants ?? []) (variants[item.id] ??= {})[v.id] = v.label;
    for (const g of item.modifierGroups ?? []) for (const o of g.options) (options[g.id] ??= {})[o.id] = o.label;
  }
  return json({ orders, bookings: bookings.filter((b) => b.status !== 'cancelled'), newParties: parties?.n ?? 0, labels: { options, variants } });
};
