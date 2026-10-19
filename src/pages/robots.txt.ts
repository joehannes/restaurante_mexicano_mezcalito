import type { APIRoute } from 'astro';

// Order pages and checkout are private to the guest; admin and the API are not pages.
export const GET: APIRoute = ({ url }) =>
  new Response(
    ['User-agent: *', 'Disallow: /admin', 'Disallow: /api/', 'Disallow: /*/o/', 'Disallow: /*/checkout', '', `Sitemap: ${url.origin}/sitemap.xml`, ''].join('\n'),
    { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' } },
  );
