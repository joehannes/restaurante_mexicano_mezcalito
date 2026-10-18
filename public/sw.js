/*
 * Mezcalito's service worker: the site keeps working on a weak beach signal.
 *
 * - Pages: network first, and the copy last seen is kept; with no network
 *   the saved copy is shown, or the menu, or a short offline note.
 * - The menu in the guest's language is saved as soon as they visit, so it
 *   can be read offline (ordering still needs the network).
 * - Built assets, fonts and media never change under the same URL, so they
 *   are served from the cache first.
 * - The API, the admin and live order pages are never cached.
 */
const VERSION = 'v1';
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const LOCALES = ['en', 'es', 'fr', 'de'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![PAGES, ASSETS].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** A page may be kept for offline reading: localized public pages only. */
const keepable = (url) =>
  url.origin === location.origin &&
  /^\/(en|es|fr|de)(\/|$)/.test(url.pathname) &&
  !/\/(o|checkout)(\/|$)/.test(url.pathname) &&
  !url.searchParams.has('season') &&
  !url.searchParams.has('k');

const offline = () =>
  new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Mezcalito</title>' +
      '<body style="font-family:system-ui;background:#fbf3e4;color:#141210;padding:2rem">' +
      '<h1>Mezcalito</h1><p>No connection right now — try again in a moment.</p>' +
      '<p>Sin conexión ahora mismo — inténtalo de nuevo en un momento.</p></body>',
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  );

async function page(request) {
  const url = new URL(request.url);
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok && keepable(url) && !response.headers.get('cache-control')?.includes('no-store')) cache.put(url.pathname, response.clone());
    return response;
  } catch {
    const lang = url.pathname.split('/')[1];
    return (
      (await cache.match(url.pathname)) ??
      (LOCALES.includes(lang) ? await cache.match(`/${lang}/menu`) : undefined) ??
      (await cache.match('/en/menu')) ??
      offline()
    );
  }
}

async function asset(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;
  if (request.mode === 'navigate') event.respondWith(page(request));
  else if (/^\/(_astro|media)\//.test(url.pathname)) event.respondWith(asset(request));
});

/** The page asks for its language's menu to be saved for offline reading. */
self.addEventListener('message', (event) => {
  const lang = event.data?.warm;
  if (!LOCALES.includes(lang)) return;
  event.waitUntil(
    fetch(`/${lang}/menu`).then(async (response) => {
      if (response.ok) await (await caches.open(PAGES)).put(`/${lang}/menu`, response);
    }, () => {}),
  );
});
