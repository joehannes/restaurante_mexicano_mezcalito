import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parseGallery } from '../../../../domain/adminInput';
import { body, contentChanged, guard, json } from '../../../../server/admin';
import { deleteGalleryItem, saveGalleryItem } from '../../../../server/gallery';

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const staff = guard(locals, 'nights');
  if (staff instanceof Response) return staff;
  const parsed = parseGallery(await body(request));
  if (!parsed.ok) return json({ error: 'invalid', fields: parsed.errors }, 400);
  if (!(await saveGalleryItem(env.DB, parsed.value, Number(params.id)))) return json({ error: 'not_found' }, 404);
  await contentChanged(env);
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  const staff = guard(locals, 'nights');
  if (staff instanceof Response) return staff;
  if (!(await deleteGalleryItem(env.DB, Number(params.id)))) return json({ error: 'not_found' }, 404);
  await contentChanged(env);
  return json({ ok: true });
};
