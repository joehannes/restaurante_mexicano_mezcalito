import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parseChoices } from '../../../../../../domain/adminInput';
import { body, contentChanged, guard, json } from '../../../../../../server/admin';
import { replaceVariants } from '../../../../../../server/staffData';

/** Replaces a dish's sizes (each with its own price); an empty list sells it at its base price. */
export const PUT: APIRoute = async ({ locals, params, request }) => {
  const staff = guard(locals, 'menu');
  if (staff instanceof Response) return staff;
  const parsed = parseChoices((await body<{ variants?: unknown }>(request))?.variants, 12);
  if (!parsed.ok) return json({ error: 'invalid', fields: ['variants'] }, 400);
  if (!(await replaceVariants(env.DB, String(params.id), parsed.value))) return json({ error: 'not_found' }, 404);
  await contentChanged(env);
  return json({ ok: true });
};
