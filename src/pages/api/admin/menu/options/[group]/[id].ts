import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { body, contentChanged, guard, json } from '../../../../../../server/admin';
import { setOptionSoldOut } from '../../../../../../server/staffData';

/** Sold out on a shared side or extra marks it out on every dish at once. */
export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const staff = guard(locals, 'soldout');
  if (staff instanceof Response) return staff;
  const input = await body<{ soldOut?: unknown }>(request);
  if (typeof input?.soldOut !== 'boolean') return json({ error: 'invalid', fields: ['soldOut'] }, 400);
  if (!(await setOptionSoldOut(env.DB, String(params.group), String(params.id), input.soldOut))) return json({ error: 'not_found' }, 404);
  await contentChanged(env);
  return json({ ok: true });
};
