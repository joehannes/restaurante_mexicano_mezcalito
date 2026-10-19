/**
 * The Worker entry: Astro renders every page and API route; this file adds
 * what Astro does not own — WebSockets to the KitchenRoom Durable Object, the
 * Durable Object export itself, the edge cache for public pages, and the cron.
 */
import astro from '@astrojs/cloudflare/entrypoints/server';
import { localNow } from './domain/schedule';
import { staffFor } from './server/access';
import { sendReminders } from './server/notify';
import { expireUnpaid } from './server/payments';

export { KitchenRoom } from './server/kitchen';

/** Guests may only listen to their own order; the board needs staff sign-in. */
const PUBLIC_TAG = /^order:MZ-[A-Z0-9]{4}$/;

/** Public pages that look the same for every guest, without a query string. */
const CACHEABLE = /^\/(en|es|fr|de)\/((menu|tonight|reserve|selector|radio|parties|story|find-us|season\/[a-z0-9-]+))?$/;
/** Edge copies live a minute: the hero follows the time of day and "open now" the clock. */
const EDGE_SECONDS = 60;

let version: { value: string; at: number } | undefined;
/** Bumped by every staff save (server/admin.ts), so edits show at once; read at most every few seconds. */
async function contentVersion(env: Env) {
  if (version && Date.now() - version.at < 5000) return version.value;
  version = { value: (await env.CACHE.get('content-version')) ?? '0', at: Date.now() };
  return version.value;
}

async function cachedPage(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const key = new Request(`${url.origin}${url.pathname}?v=${await contentVersion(env)}&b=${__BUILD_ID__}`);
  const cache = await caches.open('pages');
  const hit = await cache.match(key);
  if (hit) return hit;
  const response = await astro.fetch(request, env, ctx);
  if (response.status !== 200 || response.headers.has('set-cookie') || response.headers.get('cache-control')?.includes('no-store')) return response;
  const copy = new Response(response.body, response);
  copy.headers.set('cache-control', `public, max-age=0, s-maxage=${EDGE_SECONDS}`);
  ctx.waitUntil(cache.put(key, copy.clone()));
  return copy;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const tag = url.searchParams.get('tag') ?? '';
      if (!PUBLIC_TAG.test(tag)) return new Response('Forbidden', { status: 403 });
      return env.KITCHEN.get(env.KITCHEN.idFromName('kitchen')).fetch(request);
    }
    if (url.pathname === '/admin/ws') {
      if (!(await staffFor(request, env, import.meta.env.DEV))) return new Response('Unauthorized', { status: 401 });
      const board = new URL('https://kitchen/ws?tag=board');
      return env.KITCHEN.get(env.KITCHEN.idFromName('kitchen')).fetch(new Request(board, request));
    }
    const localized = url.pathname.match(/^\/(en|es|fr|de)(\/.*)?$/);
    if (request.method === 'GET' && localized) {
      // A visit, counted here so edge-cached pages count too: path and language only.
      try {
        env.EVENTS.writeDataPoint({ indexes: ['view'], blobs: ['view', (localized[2] ?? '/').replace(/^\/(o|season)\/.*/, '/$1'), localized[1]!], doubles: [1] });
      } catch {}
    }
    if (!import.meta.env.DEV && request.method === 'GET' && !url.search && CACHEABLE.test(url.pathname)) return cachedPage(request, env, ctx);
    return astro.fetch(request, env, ctx);
  },
  // Every five minutes: cancel online orders left unpaid, send same-day booking reminders.
  async scheduled(_controller, env, ctx) {
    const { date, minutes } = localNow(new Date(), env.TIMEZONE);
    ctx.waitUntil(Promise.allSettled([expireUnpaid(env), sendReminders(env, date, minutes)]));
  },
} satisfies ExportedHandler<Env>;
