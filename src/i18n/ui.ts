/**
 * Interface text in the four launch languages. Menu and offer text lives in
 * D1 with the content; these dictionaries are only the words around it.
 */
import { addDays } from '../domain/schedule';
import type { ClockTime, Locale } from '../domain/types';
import { formatClock } from '../lib/format';
import { de } from './de';
import { en, type UiKey } from './en';
import { es } from './es';
import { fr } from './fr';

export type { UiKey };

export const LOCALES = ['en', 'es', 'fr', 'de'] as const satisfies readonly Locale[];

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch' };

export const isLocale = (value: string | undefined): value is Locale => LOCALES.includes(value as Locale);

/** The best launch language for an Accept-Language header. */
export function negotiate(header: string | null): Locale {
  const wanted = (header ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', q = 'q=1'] = part.trim().split(';');
      return { lang: tag.slice(0, 2).toLowerCase(), q: Number(q.split('=')[1] ?? 1) };
    })
    .sort((a, b) => b.q - a.q);
  return wanted.map((w) => w.lang).find(isLocale) ?? 'en';
}

const dictionaries: Record<Locale, Record<UiKey, string>> = { en, es, fr, de };

export const t = (locale: Locale, key: UiKey, vars: Record<string, string | number> = {}) =>
  dictionaries[locale][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));

/** A translator bound to one locale, for components. */
export const translator = (locale: Locale) => (key: UiKey, vars?: Record<string, string | number>) => t(locale, key, vars);

const INTL: Record<Locale, string> = { en: 'en-US', es: 'es-DO', fr: 'fr-FR', de: 'de-DE' };

export const weekdayName = (date: string, locale: Locale) =>
  new Intl.DateTimeFormat(INTL[locale], { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

export const longDate = (date: string, locale: Locale) =>
  new Intl.DateTimeFormat(INTL[locale], { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );

/** "today at 8 am", "tomorrow at 8 am", "Friday at 8 am". */
export function when(at: { date: string; time: ClockTime }, today: string, locale: Locale) {
  const time = formatClock(at.time, locale);
  if (at.date === today) return t(locale, 'day.today', { time });
  if (at.date === addDays(today, 1)) return t(locale, 'day.tomorrow', { time });
  return t(locale, 'day.on', { day: weekdayName(at.date, locale), time });
}
