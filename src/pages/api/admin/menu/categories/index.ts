import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parseCategory } from '../../../../../domain/adminInput';
import { body, contentChanged, guard, json } from '../../../../../server/admin';
import { createCategory, orderCategories } from '../../../../../server/staffData';

export const POST: APIRoute = async ({ locals, request }) => {
  const staff = guard(locals, 'menu');
  if (staff instanceof Response) return staff;
  const parsed = parseCategory(await body(request));
  if (!parsed.ok) return json({ error: 'invalid', fields: parsed.errors }, 400);
  const id = await createCategory(env.DB, parsed.value);
  await contentChanged(env);
  return json({ id }, 201);
};

/** The order of the menu's sections: `ids` first to last. */
export const PUT: APIRoute = async ({ locals, request }) => {
  const staff = guard(locals, 'menu');
  if (staff instanceof Response) return staff;
  const ids = (await body<{ ids?: unknown }>(request))?.ids;
  if (!Array.isArray(ids) || ids.length > 100 || !ids.every((i) => typeof i === 'string')) return json({ error: 'invalid' }, 400);
  await orderCategories(env.DB, ids as string[]);
  await contentChanged(env);
  return json({ ok: true });
};
