import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Answer } from '../../../domain/radioTree';
import { isLocale } from '../../../i18n/ui';
import { radioPlate } from '../../../server/radio';

/** The plate at the end of a Radio path (or wherever the guest skipped to it). */
export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as { answers?: unknown; locale?: string };
  const answers: Answer[] = Array.isArray(body.answers)
    ? body.answers
        .slice(0, 12)
        .filter((a): a is Answer => !!a && typeof a.node === 'string' && typeof a.option === 'string')
        .map((a) => ({ node: a.node.slice(0, 40), option: a.option.slice(0, 40) }))
    : [];
  const plate = await radioPlate(env, answers, isLocale(body.locale) ? body.locale : 'en');
  return new Response(JSON.stringify(plate), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
};
