import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { body } from '../../../../server/admin';
import { switchToCash } from '../../../../server/payments';

/** The guest will pay in person after all; the order goes to the kitchen now. */
export const POST: APIRoute = async ({ params, request }) => {
  const input = await body<{ k?: string }>(request);
  const ok = await switchToCash(env, String(params.code), String(input?.k ?? ''));
  return new Response(JSON.stringify(ok ? { ok } : { error: 'not_payable' }), {
    status: ok ? 200 : 409,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
};
