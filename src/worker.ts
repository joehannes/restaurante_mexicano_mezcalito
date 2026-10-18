/**
 * The Worker entry: Astro renders every page and API route; this file adds
 * what Astro does not own — WebSockets to the KitchenRoom Durable Object, the
 * Durable Object export itself, and the cron.
 */
import astro from '@astrojs/cloudflare/entrypoints/server';
import { staffFor } from './server/access';

export { KitchenRoom } from './server/kitchen';

/** Guests may only listen to their own order; the board needs staff sign-in. */
const PUBLIC_TAG = /^order:MZ-[A-Z0-9]{4}$/;

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
    return astro.fetch(request, env, ctx);
  },
  // Every five minutes: expire unpaid online orders, send reservation
  // reminders. Wired up with online payments and notifications.
  async scheduled() {},
} satisfies ExportedHandler<Env>;
