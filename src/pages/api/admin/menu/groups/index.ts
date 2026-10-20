import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parseGroup } from '../../../../../domain/adminInput';
import { body, contentChanged, guard, json } from '../../../../../server/admin';
import { saveGroup } from '../../../../../server/staffData';

/** A new extras group (sides, sauces, add-ons); link it to dishes from each dish. */
export const POST: APIRoute = async ({ locals, request }) => {
  const staff = guard(locals, 'menu');
  if (staff instanceof Response) return staff;
  const parsed = parseGroup(await body(request));
  if (!parsed.ok) return json({ error: 'invalid', fields: parsed.errors }, 400);
  const id = await saveGroup(env.DB, parsed.value);
  await contentChanged(env);
  return json({ id }, 201);
};
