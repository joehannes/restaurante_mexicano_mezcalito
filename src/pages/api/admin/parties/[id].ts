import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { body, guard, json } from '../../../../server/admin';
import { setPartyStatus } from '../../../../server/staffData';

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const staff = guard(locals, 'reservations');
  if (staff instanceof Response) return staff;
  const input = await body<{ status?: string }>(request);
  if (!(await setPartyStatus(env.DB, Number(params.id), String(input?.status)))) return json({ error: 'invalid' }, 400);
  return json({ ok: true });
};
