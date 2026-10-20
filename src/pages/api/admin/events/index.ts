import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parseEvent } from '../../../../domain/adminInput';
import { body, contentChanged, guard, json } from '../../../../server/admin';
import { loadEvents, saveEvent } from '../../../../server/events';

/** Every event, past, live and drafts. */
export const GET: APIRoute = async ({ locals }) => {
  const staff = guard(locals, 'nights');
  if (staff instanceof Response) return staff;
  return json({ events: await loadEvents(env.DB, { all: true }) });
};

/** Creates or replaces the event with this slug. */
export const POST: APIRoute = async ({ locals, request }) => {
  const staff = guard(locals, 'nights');
  if (staff instanceof Response) return staff;
  const parsed = parseEvent(await body(request));
  if (!parsed.ok) return json({ error: 'invalid', fields: parsed.errors }, 400);
  await saveEvent(env.DB, parsed.value);
  await contentChanged(env);
  return json({ slug: parsed.value.slug });
};
