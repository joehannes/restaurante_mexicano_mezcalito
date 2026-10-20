import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { contentChanged, guard, json } from '../../../../server/admin';
import { deleteEvent } from '../../../../server/events';

export const DELETE: APIRoute = async ({ locals, params }) => {
  const staff = guard(locals, 'nights');
  if (staff instanceof Response) return staff;
  if (!(await deleteEvent(env.DB, String(params.slug)))) return json({ error: 'not_found' }, 404);
  await contentChanged(env);
  return json({ ok: true });
};
