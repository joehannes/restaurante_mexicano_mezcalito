import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { guard, json } from '../../../../server/admin';
import { loadMenu } from '../../../../server/menu';
import { adminMenu } from '../../../../server/staffData';

/** The whole menu, hidden dishes included, with the shared sides and extras. */
export const GET: APIRoute = async ({ locals }) => {
  const staff = guard(locals, 'soldout');
  if (staff instanceof Response) return staff;
  const [items, rest] = await Promise.all([loadMenu(env.DB), adminMenu(env.DB)]);
  return json({ items, ...rest });
};
