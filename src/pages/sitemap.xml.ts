import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { LOCALES } from '../i18n/ui';
import { sitemapXml } from '../lib/sitemap';
import { PUBLIC_PATHS } from '../server/page';

export const GET: APIRoute = async ({ url }) => {
  const { results: seasons } = await env.DB.prepare('SELECT slug, substr(updated_at, 1, 10) AS lastmod FROM seasons WHERE published = 1').all<{ slug: string; lastmod: string }>();
  const pages = [...PUBLIC_PATHS.map((path) => ({ path })), ...seasons.map((s) => ({ path: `/season/${s.slug}`, lastmod: s.lastmod }))];
  return new Response(sitemapXml(url.origin, LOCALES, pages), {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
};
