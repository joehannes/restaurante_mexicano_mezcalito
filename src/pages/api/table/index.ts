import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { tellKitchen } from '../../../server/orders';

/** A guest at a table calls the waiter or asks for the bill; the orders board chimes. */
export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as { table?: unknown; request?: unknown };
  const table = typeof body.table === 'string' && /^[A-Za-z0-9-]{1,12}$/.test(body.table) ? body.table : undefined;
  const kind = body.request === 'waiter' || body.request === 'bill' ? body.request : undefined;
  if (!table || !kind) return new Response(JSON.stringify({ error: 'invalid' }), { status: 400, headers: { 'content-type': 'application/json' } });
  await tellKitchen(env, 'board', { type: 'table.call', table, request: kind, at: new Date().toISOString() });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
};
