/**
 * The Worker entry: Astro renders every page and API route; this file adds
 * what Astro does not own — the KitchenRoom Durable Object and the cron.
 */
import astro from '@astrojs/cloudflare/entrypoints/server';

export { KitchenRoom } from './server/kitchen';

export default {
  fetch: astro.fetch,
  // Every five minutes: expire unpaid online orders, send reservation
  // reminders. Wired up with the order and reservation flows.
  async scheduled() {},
} satisfies ExportedHandler<Env>;
