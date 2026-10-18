/**
 * Interface text in the four launch languages. Menu and offer text lives in
 * D1 with the content; this file is only the words around it.
 */
import type { Locale } from '../domain/types';

export const LOCALES = ['en', 'es', 'fr', 'de'] as const satisfies readonly Locale[];

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

const en = {
  'nav.menu': 'Menu',
  'nav.order': 'Order',
  'nav.book': 'Book a table',
  'nav.tonight': 'Tonight',
  'status.open': 'Open now',
  'status.closes': 'closes {time}',
  'status.closed': 'Closed now',
  'status.opens': 'opens {day} {time}',
  'tagline': 'Jamaican Mexican fusion',
  'slogan': 'One love. Mucho sabor.',
  'tonight.title': 'On tonight',
  'tonight.empty': 'No special tonight — the kitchen is still cooking.',
  'price.from': 'from',
};
type Key = keyof typeof en;

const dictionaries: Record<Locale, Record<Key, string>> = {
  en,
  es: {
    'nav.menu': 'Menú',
    'nav.order': 'Ordenar',
    'nav.book': 'Reservar mesa',
    'nav.tonight': 'Esta noche',
    'status.open': 'Abierto ahora',
    'status.closes': 'cierra {time}',
    'status.closed': 'Cerrado ahora',
    'status.opens': 'abre {day} {time}',
    'tagline': 'Fusión jamaiquina y mexicana',
    'slogan': 'One love. Mucho sabor.',
    'tonight.title': 'Esta noche',
    'tonight.empty': 'Hoy no hay especial — la cocina sigue cocinando.',
    'price.from': 'desde',
  },
  fr: {
    'nav.menu': 'Menu',
    'nav.order': 'Commander',
    'nav.book': 'Réserver',
    'nav.tonight': 'Ce soir',
    'status.open': 'Ouvert',
    'status.closes': 'ferme à {time}',
    'status.closed': 'Fermé',
    'status.opens': 'ouvre {day} à {time}',
    'tagline': 'Fusion jamaïcaine et mexicaine',
    'slogan': 'One love. Mucho sabor.',
    'tonight.title': 'Ce soir',
    'tonight.empty': 'Pas de soirée spéciale ce soir — la cuisine tourne quand même.',
    'price.from': 'à partir de',
  },
  de: {
    'nav.menu': 'Speisekarte',
    'nav.order': 'Bestellen',
    'nav.book': 'Tisch reservieren',
    'nav.tonight': 'Heute Abend',
    'status.open': 'Jetzt geöffnet',
    'status.closes': 'schließt um {time}',
    'status.closed': 'Jetzt geschlossen',
    'status.opens': 'öffnet {day} um {time}',
    'tagline': 'Jamaikanisch-mexikanische Fusion',
    'slogan': 'One love. Mucho sabor.',
    'tonight.title': 'Heute Abend',
    'tonight.empty': 'Heute kein Special — die Küche kocht trotzdem.',
    'price.from': 'ab',
  },
};

export const t = (locale: Locale, key: Key, vars: Record<string, string> = {}) =>
  dictionaries[locale][key].replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? '');
