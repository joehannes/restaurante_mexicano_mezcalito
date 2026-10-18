/**
 * The sitemap: every public page in every language, each entry listing its
 * siblings in the other languages so search engines treat them as one page.
 */
import type { Locale } from '../domain/types';

export interface SitemapPage {
  /** Path after the locale, e.g. `/menu`. */
  path: string;
  /** YYYY-MM-DD */
  lastmod?: string;
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function sitemapXml(origin: string, locales: readonly Locale[], pages: SitemapPage[]): string {
  const url = (locale: string, path: string) => escape(`${origin}/${locale}${path === '/' ? '/' : path}`);
  const entries = pages.flatMap(({ path, lastmod }) =>
    locales.map((locale) =>
      [
        '  <url>',
        `    <loc>${url(locale, path)}</loc>`,
        ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
        ...locales.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${url(l, path)}"/>`),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${url('en', path)}"/>`,
        '  </url>',
      ].join('\n'),
    ),
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}
