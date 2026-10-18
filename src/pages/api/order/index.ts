import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parseOrderInput } from '../../../domain/orderInput';
import { placeOrder } from '../../../server/orders';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid', fields: ['body'] }, 400);
  }
  // A field no person can see: anything that fills it is a bot.
  if ((body as { website?: string })?.website) return json({ error: 'invalid' }, 400);

  const parsed = parseOrderInput(body);
  if (!parsed.ok) return json({ error: 'invalid', fields: parsed.errors }, 400);

  const result = await placeOrder(env, parsed.value);
  if (!result.ok) {
    if (result.error === 'storage') {
      console.error('order storage failed', result.detail);
      return json({ error: 'storage' }, 500);
    }
    return json({ error: result.error, detail: result.detail }, 409);
  }
  return json({ code: result.code, key: result.key, total: result.total }, 201);
};
