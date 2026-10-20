import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parseItemPatch } from '../../../../../domain/adminInput';
import { body, contentChanged, guard, json } from '../../../../../server/admin';
import { deleteItem, updateItem } from '../../../../../server/staffData';

/** The kitchen may only flip sold out; everything else needs the menu permission. */
export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const input = await body(request);
  const onlySoldOut = !!input && Object.keys(input).every((k) => k === 'soldOut');
  const staff = guard(locals, onlySoldOut ? 'soldout' : 'menu');
  if (staff instanceof Response) return staff;
  const parsed = parseItemPatch(input);
  if (!parsed.ok) return json({ error: 'invalid', fields: parsed.errors }, 400);
  if (!(await updateItem(env.DB, String(params.id), parsed.value))) return json({ error: 'not_found' }, 404);
  await contentChanged(env);
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  const staff = guard(locals, 'menu');
  if (staff instanceof Response) return staff;
  if (!(await deleteItem(env.DB, String(params.id)))) return json({ error: 'not_found' }, 404);
  await contentChanged(env);
  return json({ ok: true });
};
