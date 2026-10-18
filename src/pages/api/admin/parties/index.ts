import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { guard, json } from '../../../../server/admin';
import { partyRequests } from '../../../../server/staffData';

export const GET: APIRoute = async ({ locals }) => {
  const staff = guard(locals, 'reservations');
  if (staff instanceof Response) return staff;
  return json({ requests: await partyRequests(env.DB) });
};
