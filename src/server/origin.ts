/**
 * Where the site lives, for links in messages and search-engine data.
 * SITE_URL wins once a custom domain is set; until then it is the address
 * guests actually use (the workers.dev URL), remembered in KV for messages
 * sent outside a request, like the reminder cron.
 */
import { waitUntil } from 'cloudflare:workers';

let seen: string | undefined;

/** Called on every request; writes KV only when the address changes. */
export function rememberOrigin(env: Env, origin: string) {
  if (env.SITE_URL || seen === origin || !origin.startsWith('https://')) return;
  seen = origin;
  waitUntil(env.CACHE.get('origin').then((stored) => (stored === origin ? undefined : env.CACHE.put('origin', origin))));
}

export async function siteUrl(env: Env): Promise<string> {
  return env.SITE_URL || seen || (await env.CACHE.get('origin')) || '';
}
