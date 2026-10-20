import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parseGallery } from '../../../../domain/adminInput';
import { body, contentChanged, guard, json } from '../../../../server/admin';
import { loadGallery, orderGallery, saveGalleryItem } from '../../../../server/gallery';

/** The whole wall, hidden pictures included. */
export const GET: APIRoute = async ({ locals }) => {
  const staff = guard(locals, 'nights');
  if (staff instanceof Response) return staff;
  return json({ items: await loadGallery(env.DB, { all: true }) });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const staff = guard(locals, 'nights');
  if (staff instanceof Response) return staff;
  const parsed = parseGallery(await body(request));
  if (!parsed.ok) return json({ error: 'invalid', fields: parsed.errors }, 400);
  const id = await saveGalleryItem(env.DB, parsed.value);
  await contentChanged(env);
  return json({ id }, 201);
};

/** The wall's order: `ids` first to last. */
export const PUT: APIRoute = async ({ locals, request }) => {
  const staff = guard(locals, 'nights');
  if (staff instanceof Response) return staff;
  const ids = (await body<{ ids?: unknown }>(request))?.ids;
  if (!Array.isArray(ids) || ids.length > 500 || !ids.every((i) => Number.isInteger(i))) return json({ error: 'invalid' }, 400);
  await orderGallery(env.DB, ids as number[]);
  await contentChanged(env);
  return json({ ok: true });
};
