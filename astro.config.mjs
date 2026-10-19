// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  // Workers AI only runs on Cloudflare, so local dev reaches it through a
  // remote proxy that needs an API token. Without one, everything else still
  // runs locally (D1, KV, R2, the Durable Object) and AI calls fail cleanly.
  adapter: cloudflare({ remoteBindings: !!process.env.CLOUDFLARE_API_TOKEN }),
  integrations: [react()],
  // The old static site's pages, so links and search results keep working.
  redirects: Object.fromEntries(
    [
      ['/index.html', '/'],
      ['/menu.html', '/en/menu'],
      ['/daily.html', '/en/tonight'],
      ['/deals.html', '/en/tonight'],
      ['/about.html', '/en/story'],
      ['/catering.html', '/en/parties'],
      ['/contact.html', '/en/find-us'],
    ].map(([from, to]) => [from, { status: 301, destination: to }]),
  ),
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    // Part of the edge-cache key, so a deploy never serves pages the old code rendered.
    define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  },
});
