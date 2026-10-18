import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { contentChanged, guard, json } from '../../../../server/admin';
import { deleteSpecial } from '../../../../server/staffData';

export const DELETE: APIRoute = async ({ locals, params }) => {
  const staff = guard(locals, 'nights');
  if (staff instanceof Response) return staff;
  if (!(await deleteSpecial(env.DB, String(params.id)))) return json({ error: 'not_found' }, 404);
  await contentChanged(env);
  return json({ ok: true });
};
