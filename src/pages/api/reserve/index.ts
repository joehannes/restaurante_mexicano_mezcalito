import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parseReservationInput } from '../../../domain/reservationInput';
import { book } from '../../../server/reservations';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid', fields: ['body'] }, 400);
  }
  if ((body as { website?: string })?.website) return json({ error: 'invalid' }, 400);
  const parsed = parseReservationInput(body);
  if (!parsed.ok) return json({ error: 'invalid', fields: parsed.errors }, 400);
  const result = await book(env, parsed.value);
  if (!result.ok) return json({ error: result.reason }, result.reason === 'storage' ? 500 : 409);
  return json({ code: result.code, seatingMinutes: result.seatingMinutes }, 201);
};
