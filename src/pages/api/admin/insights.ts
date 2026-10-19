import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { guard, json } from '../../../server/admin';
import { insights } from '../../../server/insights';

export const GET: APIRoute = async ({ locals, url }) => {
  const staff = guard(locals, 'insights');
  if (staff instanceof Response) return staff;
  const days = [7, 30, 90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
  return json(await insights(env, days));
};
