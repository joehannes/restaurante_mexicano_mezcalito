/**
 * What almost every page needs: the language, Bávaro's "now", the site
 * settings, the nights and the season that is live.
 */
import { env } from 'cloudflare:workers';
import { activeSeason, daypart, localNow, openStatus } from '../domain/schedule';
import type { Locale } from '../domain/types';
import { isLocale } from '../i18n/ui';
import { loadSite } from './content';

export async function pageContext(lang: string | undefined) {
  if (!isLocale(lang)) return undefined;
  const locale: Locale = lang;
  const now = new Date();
  const tz = env.TIMEZONE;
  const { site, specials, seasons } = await loadSite(env.DB);
  return {
    locale,
    now,
    tz,
    today: localNow(now, tz).date,
    site,
    specials,
    season: activeSeason(now, seasons, tz),
    status: openStatus(now, site.hours, site.closures, tz),
    part: daypart(now, tz),
  };
}

export type PageContext = NonNullable<Awaited<ReturnType<typeof pageContext>>>;

export const href = (locale: Locale, path = '/') => `/${locale}${path === '/' ? '/' : path}`;

export const notFound = () => new Response(null, { status: 404 });
