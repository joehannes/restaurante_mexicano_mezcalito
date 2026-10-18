/**
 * Everything under /admin and /api/admin needs a signed-in member of staff.
 * Which staff may do what is checked by each route (see server/admin.ts).
 * Guests' posts to the API are rate limited.
 */
import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { staffFor } from './server/access';

const ADMIN = /^\/(api\/)?admin(\/|$)/;

export const onRequest = defineMiddleware(async ({ request, url, locals, clientAddress }, next) => {
  // Guests' posts (orders, bookings, parties, The Selector) are rate limited per visitor.
  if (request.method === 'POST' && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/admin/') && env.PUBLIC_LIMIT) {
    const { success } = await env.PUBLIC_LIMIT.limit({ key: clientAddress ?? 'unknown' });
    if (!success) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '60' } });
  }
  if (!ADMIN.test(url.pathname)) return next();

  const staff = await staffFor(request, env, import.meta.env.DEV);
  if (!staff) {
    const api = url.pathname.startsWith('/api/');
    return new Response(api ? JSON.stringify({ error: 'unauthorized' }) : 'Staff sign-in required. Open /admin through Cloudflare Access.', {
      status: 401,
      headers: { 'content-type': api ? 'application/json' : 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  // Writes must come from our own pages: a cross-site form cannot set this
  // header without a CORS preflight, which the API never grants.
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.headers.get('x-mezcalito') !== 'admin') {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
  }

  locals.staff = staff;
  const response = await next();
  response.headers.set('cache-control', 'no-store');
  response.headers.set('x-robots-tag', 'noindex');
  return response;
});
