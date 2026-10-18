import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parseSeason } from '../../../../domain/adminInput';
import { body, contentChanged, guard, json } from '../../../../server/admin';
import { deleteSeason, saveSeason } from '../../../../server/staffData';

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const staff = guard(locals, 'seasons');
  if (staff instanceof Response) return staff;
  const parsed = parseSeason(await body(request));
  if (!parsed.ok) return json({ error: 'invalid', fields: parsed.errors }, 400);
  if (parsed.value.slug !== params.slug) return json({ error: 'invalid', fields: ['slug'] }, 400);
  await saveSeason(env.DB, parsed.value);
  await contentChanged(env);
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  const staff = guard(locals, 'seasons');
  if (staff instanceof Response) return staff;
  if (!(await deleteSeason(env.DB, String(params.slug)))) return json({ error: 'not_found' }, 404);
  await contentChanged(env);
  return json({ ok: true });
};
