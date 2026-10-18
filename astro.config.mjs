// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://mezcalitobarandgrill.com',
  output: 'server',
  // Workers AI only runs on Cloudflare, so local dev reaches it through a
  // remote proxy that needs an API token. Without one, everything else still
  // runs locally (D1, KV, R2, the Durable Object) and AI calls fail cleanly.
  adapter: cloudflare({ remoteBindings: !!process.env.CLOUDFLARE_API_TOKEN }),
  integrations: [react()],
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
  },
});
