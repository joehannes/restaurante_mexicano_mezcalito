import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parseSpecial } from '../../../../domain/adminInput';
import { body, contentChanged, guard, json } from '../../../../server/admin';
import { loadSite } from '../../../../server/content';
import { orderSpecials, saveSpecial } from '../../../../server/staffData';

export const GET: APIRoute = async ({ locals }) => {
  const staff = guard(locals, 'nights');
  if (staff instanceof Response) return staff;
  return json({ specials: (await loadSite(env.DB)).specials });
};

/** Create or replace one night; `{ order: [ids] }` saves the line-up order instead. */
export const POST: APIRoute = async ({ locals, request }) => {
  const staff = guard(locals, 'nights');
  if (staff instanceof Response) return staff;
  const input = await body<{ order?: unknown }>(request);
  if (Array.isArray(input?.order) && input.order.every((id) => typeof id === 'string')) {
    await orderSpecials(env.DB, input.order as string[]);
  } else {
    const parsed = parseSpecial(input);
    if (!parsed.ok) return json({ error: 'invalid', fields: parsed.errors }, 400);
    await saveSpecial(env.DB, parsed.value);
  }
  await contentChanged(env);
  return json({ ok: true });
};
