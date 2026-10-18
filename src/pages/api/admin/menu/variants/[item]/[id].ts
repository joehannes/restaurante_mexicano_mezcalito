import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { body, contentChanged, guard, json } from '../../../../../../server/admin';
import { updateVariant } from '../../../../../../server/staffData';

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const input = await body<{ soldOut?: unknown; price?: unknown }>(request);
  const staff = guard(locals, input && 'price' in input ? 'menu' : 'soldout');
  if (staff instanceof Response) return staff;
  if (!input || (input.soldOut !== undefined && typeof input.soldOut !== 'boolean')) return json({ error: 'invalid', fields: ['soldOut'] }, 400);
  if (input.price !== undefined && !(Number.isInteger(input.price) && (input.price as number) >= 0)) return json({ error: 'invalid', fields: ['price'] }, 400);
  const patch = { soldOut: input.soldOut as boolean | undefined, price: input.price as number | undefined };
  if (!(await updateVariant(env.DB, String(params.item), String(params.id), patch))) return json({ error: 'not_found' }, 404);
  await contentChanged(env);
  return json({ ok: true });
};
