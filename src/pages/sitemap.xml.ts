import type { APIRoute } from 'astro';
import { LOCALES } from '../i18n/ui';
import { sitemapXml } from '../lib/sitemap';
import { PUBLIC_PATHS } from '../server/page';

export const GET: APIRoute = ({ site }) =>
  new Response(sitemapXml(site!.origin, LOCALES, PUBLIC_PATHS.map((path) => ({ path }))), {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
