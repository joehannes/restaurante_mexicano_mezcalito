import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { azulReturn } from '../../../../../../server/payments';

// Azul comes back by redirect; accept a posted form as well.
const handle: APIRoute = async ({ params, request, url }) => {
  const fields = request.method === 'POST' ? new URLSearchParams([...(await request.formData())].map(([k, v]) => [k, String(v)])) : url.searchParams;
  return azulReturn(env, url.origin, String(params.outcome), String(params.code), String(params.key), fields);
};
export const GET = handle;
export const POST = handle;
