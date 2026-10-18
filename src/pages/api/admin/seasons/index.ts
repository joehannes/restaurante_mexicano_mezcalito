import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { localNow } from '../../../../domain/schedule';
import { draftFromPreset, PRESETS } from '../../../../domain/seasonPresets';
import { body, guard, json } from '../../../../server/admin';
import { loadSite } from '../../../../server/content';
import { loadMenu } from '../../../../server/menu';
import { saveSeason } from '../../../../server/staffData';

/** Every season, the presets to start one from, and the dishes and nights a season page can feature. */
export const GET: APIRoute = async ({ locals }) => {
  const staff = guard(locals, 'seasons');
  if (staff instanceof Response) return staff;
  const [{ seasons, specials }, menu] = await Promise.all([loadSite(env.DB), loadMenu(env.DB)]);
  return json({
    seasons,
    presets: PRESETS.map((p) => ({ slug: p.slug, name: p.name })),
    dishes: menu.filter((i) => !i.hidden).map((i) => ({ id: i.id, name: i.name })),
    nights: specials.map((s) => ({ id: s.id, title: s.title })),
    today: localNow(new Date(), env.TIMEZONE).date,
  });
};

/** `{ preset }` starts a draft season from a preset. */
export const POST: APIRoute = async ({ locals, request }) => {
  const staff = guard(locals, 'seasons');
  if (staff instanceof Response) return staff;
  const input = await body<{ preset?: string }>(request);
  const draft = draftFromPreset(String(input?.preset), localNow(new Date(), env.TIMEZONE).date);
  if (!draft) return json({ error: 'invalid', fields: ['preset'] }, 400);
  if (await env.DB.prepare('SELECT 1 FROM seasons WHERE slug = ?').bind(draft.slug).first()) return json({ error: 'exists', slug: draft.slug }, 409);
  await saveSeason(env.DB, { ...draft, published: false, playlistUrl: null, ogImage: null });
  return json({ slug: draft.slug }, 201);
};
