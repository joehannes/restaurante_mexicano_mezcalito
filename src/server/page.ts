/**
 * What almost every page needs: the language, Bávaro's "now", the site
 * settings, the nights and the season that is live.
 */
import { env } from 'cloudflare:workers';
import { activeSeason, daypart, localNow, openStatus } from '../domain/schedule';
import type { Locale } from '../domain/types';
import { isLocale } from '../i18n/ui';
import { staffFor } from './access';
import { loadSite } from './content';

/**
 * Pass the request to let signed-in staff preview any season, published or
 * not, with `?season=<slug>`.
 */
export async function pageContext(lang: string | undefined, request?: Request) {
  if (!isLocale(lang)) return undefined;
  const locale: Locale = lang;
  const now = new Date();
  const tz = env.TIMEZONE;
  const { site, specials, seasons } = await loadSite(env.DB);
  let season = activeSeason(now, seasons, tz);
  const wanted = request && new URL(request.url).searchParams.get('season');
  const preview = !!wanted && !!(await staffFor(request, env, import.meta.env.DEV));
  if (preview) season = seasons.find((s) => s.slug === wanted) ?? season;
  return {
    locale,
    now,
    tz,
    today: localNow(now, tz).date,
    site,
    specials,
    seasons,
    season,
    preview,
    status: openStatus(now, site.hours, site.closures, tz),
    part: daypart(now, tz),
  };
}

export type PageContext = NonNullable<Awaited<ReturnType<typeof pageContext>>>;

/** Every localized page a guest or a search engine may land on. */
export const PUBLIC_PATHS = ['/', '/menu', '/tonight', '/reserve', '/parties', '/story', '/find-us'];

export const href =(locale: Locale, path = '/') => `/${locale}${path === '/' ? '/' : path}`;

export const notFound = () => new Response(null, { status: 404 });
