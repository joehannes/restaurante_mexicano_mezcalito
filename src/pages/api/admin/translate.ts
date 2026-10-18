import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { body, guard, json } from '../../../server/admin';

const TARGETS = ['es', 'fr', 'de'] as const;

/**
 * Draft translations of an English menu or offer text. Only a draft: the
 * admin shows them in the fields for staff to read and fix before saving.
 */
export const POST: APIRoute = async ({ locals, request }) => {
  const staff = guard(locals, 'menu');
  if (staff instanceof Response) return staff;
  const input = await body<{ text?: string }>(request);
  const text = String(input?.text ?? '').trim().slice(0, 400);
  if (!text) return json({ error: 'invalid', fields: ['text'] }, 400);
  try {
    const drafts = await Promise.all(
      TARGETS.map(async (target) => {
        const out = (await env.AI.run('@cf/meta/m2m100-1.2b', { text, source_lang: 'english', target_lang: target })) as { translated_text?: string };
        return [target, out.translated_text?.trim() ?? ''] as const;
      }),
    );
    return json(Object.fromEntries(drafts));
  } catch (error) {
    console.error('translation failed', error);
    return json({ error: 'ai_unavailable' }, 503);
  }
};
