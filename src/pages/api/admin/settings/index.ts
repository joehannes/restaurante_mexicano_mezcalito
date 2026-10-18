import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { guard, json } from '../../../../server/admin';

export const GET: APIRoute = async ({ locals }) => {
  const staff = guard(locals, 'settings');
  if (staff instanceof Response) return staff;
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  return json(Object.fromEntries(results.map((r) => [r.key, JSON.parse(r.value)])));
};
