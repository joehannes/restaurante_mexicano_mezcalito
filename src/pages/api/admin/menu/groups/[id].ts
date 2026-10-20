import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parseGroup } from '../../../../../domain/adminInput';
import { body, contentChanged, guard, json } from '../../../../../server/admin';
import { deleteGroup, saveGroup } from '../../../../../server/staffData';

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const staff = guard(locals, 'menu');
  if (staff instanceof Response) return staff;
  const parsed = parseGroup(await body(request));
  if (!parsed.ok) return json({ error: 'invalid', fields: parsed.errors }, 400);
  if (!(await saveGroup(env.DB, parsed.value, String(params.id)))) return json({ error: 'not_found' }, 404);
  await contentChanged(env);
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  const staff = guard(locals, 'menu');
  if (staff instanceof Response) return staff;
  if (!(await deleteGroup(env.DB, String(params.id)))) return json({ error: 'not_found' }, 404);
  await contentChanged(env);
  return json({ ok: true });
};
