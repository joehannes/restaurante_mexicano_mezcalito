import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { slotsFor } from '../../../server/reservations';

export const GET: APIRoute = async ({ url }) => {
  const date = url.searchParams.get('date') ?? '';
  const party = Number(url.searchParams.get('party') ?? 2);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(party) || party < 1) {
    return new Response(JSON.stringify({ error: 'invalid' }), { status: 400 });
  }
  const body = await slotsFor(env, date, party);
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
};
