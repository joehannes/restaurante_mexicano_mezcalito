/**
 * Prices and times the way guests read them.
 *
 * Prices are always shown in Dominican pesos (that is what the till charges)
 * with the "RD$" prefix every guest here already knows; the US-dollar figure
 * is only ever an estimate beside it.
 */
import type { ClockTime, Locale } from '../domain/types';

const GROUPING: Record<Locale, string> = { en: 'en-US', es: 'es-DO', fr: 'fr-FR', de: 'de-DE' };

const number = (value: number, locale: Locale, fractionDigits: number) =>
  new Intl.NumberFormat(GROUPING[locale], {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: 'always',
  })
    .format(value)
    // French groups with a narrow no-break space; a plain one reads the same
    // and survives every font.
    .replace(/ | /g, ' ');

export function formatPrice(centavos: number, locale: Locale): string {
  const whole = centavos % 100 === 0;
  return `RD$${number(centavos / 100, locale, whole ? 0 : 2)}`;
}

export const formatUsd = (centavos: number, pesosPerDollar: number, locale: Locale) =>
  `≈ US$${number(Math.round(centavos / 100 / pesosPerDollar), locale, 0)}`;

export function formatClock(time: ClockTime, locale: Locale): string {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const hour = h % 24;
  if (locale !== 'en') return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const h12 = hour % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${hour < 12 ? 'am' : 'pm'}`;
}
