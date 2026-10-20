import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parseItemPatch } from '../../../../../domain/adminInput';
import { body, contentChanged, guard, json } from '../../../../../server/admin';
import { createItem, orderItems } from '../../../../../server/staffData';

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

export const POST: APIRoute = async ({ locals, request }) => {
  const staff = guard(locals, 'menu');
  if (staff instanceof Response) return staff;
  const parsed = parseItemPatch(await body(request));
  if (!parsed.ok) return json({ error: 'invalid', fields: parsed.errors }, 400);
  const { categoryId, name, price } = parsed.value;
  if (!categoryId || !name || price === undefined) return json({ error: 'invalid', fields: ['categoryId', 'name', 'price'].filter((k) => !(k in parsed.value)) }, 400);
  const base = slug(name.en) || 'dish';
  let id = base;
  for (let n = 2; await env.DB.prepare('SELECT 1 FROM menu_items WHERE id = ?').bind(id).first(); n++) id = `${base}-${n}`;
  await createItem(env.DB, id, { ...parsed.value, categoryId, name, price });
  await contentChanged(env);
  return json({ id }, 201);
};

/** The order of dishes: `ids` first to last. */
export const PUT: APIRoute = async ({ locals, request }) => {
  const staff = guard(locals, 'menu');
  if (staff instanceof Response) return staff;
  const input = await body<{ ids?: unknown }>(request);
  const ids = input?.ids;
  if (!Array.isArray(ids) || ids.length > 500 || !ids.every((i) => typeof i === 'string')) return json({ error: 'invalid' }, 400);
  await orderItems(env.DB, ids as string[]);
  await contentChanged(env);
  return json({ ok: true });
};
