import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { guard, json } from '../../../../../server/admin';
import { loadRadio, renderVoice } from '../../../../../server/radio';

/** Renders this question's voice in every language Workers AI speaks. */
export const POST: APIRoute = async ({ locals, params }) => {
  const staff = guard(locals, 'radio');
  if (staff instanceof Response) return staff;
  const { nodes } = await loadRadio(env.DB);
  const node = nodes.find((n) => n.id === params.node);
  if (!node) return json({ error: 'not_found' }, 404);
  return json(await renderVoice(env, node));
};
