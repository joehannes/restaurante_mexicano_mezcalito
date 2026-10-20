import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parseCategory } from '../../../../../domain/adminInput';
import { body, contentChanged, guard, json } from '../../../../../server/admin';
import { deleteCategory, updateCategory } from '../../../../../server/staffData';

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const staff = guard(locals, 'menu');
  if (staff instanceof Response) return staff;
  const parsed = parseCategory(await body(request));
  if (!parsed.ok) return json({ error: 'invalid', fields: parsed.errors }, 400);
  if (!(await updateCategory(env.DB, String(params.id), parsed.value))) return json({ error: 'not_found' }, 404);
  await contentChanged(env);
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  const staff = guard(locals, 'menu');
  if (staff instanceof Response) return staff;
  const result = await deleteCategory(env.DB, String(params.id));
  if (result !== 'ok') return json({ error: result }, result === 'not_found' ? 404 : 409);
  await contentChanged(env);
  return json({ ok: true });
};
