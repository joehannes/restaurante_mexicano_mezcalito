import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { paypalReturn } from '../../../../../../server/payments';

export const GET: APIRoute = ({ params, url }) => paypalReturn(env, url.origin, String(params.outcome), String(params.code), String(params.key), url.searchParams);
