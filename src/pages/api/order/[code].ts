import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { loadOrder } from '../../../server/orders';

/** Status for the guest's order page; personal details only with the key. */
export const GET: APIRoute = async ({ params, url }) => {
  const order = await loadOrder(env.DB, String(params.code), url.searchParams.get('k'));
  if (!order) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
  return new Response(JSON.stringify(order), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
};
