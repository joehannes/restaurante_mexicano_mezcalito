import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parsePreferences } from '../../../domain/selector';
import { isLocale } from '../../../i18n/ui';
import { pickPlate } from '../../../server/selector';

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as { locale?: string; wish?: unknown };
  const prefs = parsePreferences(body);
  const locale = isLocale(body.locale) ? body.locale : 'en';
  const wish = typeof body.wish === 'string' ? body.wish.trim().slice(0, 200) : '';
  const answer = await pickPlate(env, prefs, locale, wish);
  try {
    env.EVENTS.writeDataPoint({ indexes: ['selector'], blobs: ['selector', answer.source, prefs.hunger, prefs.heat, prefs.leaning, locale], doubles: [1] });
  } catch {}
  return new Response(JSON.stringify(answer), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
};
