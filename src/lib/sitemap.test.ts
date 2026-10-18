import { describe, expect, it } from 'vitest';
import { sitemapXml } from './sitemap';

describe('sitemapXml', () => {
  const xml = sitemapXml('https://example.com', ['en', 'es'], [{ path: '/' }, { path: '/menu', lastmod: '2026-10-18' }]);

  it('lists every page in every language', () => {
    expect(xml.match(/<loc>/g)).toHaveLength(4);
    expect(xml).toContain('<loc>https://example.com/en/</loc>');
    expect(xml).toContain('<loc>https://example.com/es/menu</loc>');
  });
  it('links each entry to its language siblings and an x-default', () => {
    const menuEs = xml.split('<url>').find((u) => u.includes('<loc>https://example.com/es/menu</loc>'))!;
    expect(menuEs).toContain('hreflang="en" href="https://example.com/en/menu"');
    expect(menuEs).toContain('hreflang="x-default" href="https://example.com/en/menu"');
    expect(menuEs).toContain('<lastmod>2026-10-18</lastmod>');
  });
  it('escapes ampersands', () => {
    expect(sitemapXml('https://e.com', ['en'], [{ path: '/a&b' }])).toContain('/en/a&amp;b');
  });
});
