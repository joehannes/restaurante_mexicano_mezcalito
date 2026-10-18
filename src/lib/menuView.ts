/** Small read-only views over menu items, shared by pages and islands. */
import type { Locale, MenuItem } from '../domain/types';
import { t } from '../i18n/ui';

/** The lowest price a guest can pay for the dish, for "from RD$…" labels. */
export const fromPrice = (item: MenuItem) =>
  item.variants?.length ? Math.min(...item.variants.filter((v) => !v.soldOut).map((v) => v.price), Infinity) : item.price;

export const hasChoices = (item: MenuItem) =>
  !!item.variants?.length || !!item.modifierGroups?.length || item.unit === 'lb';

export const fusionLabel = (fusion: number, locale: Locale) =>
  fusion < 0 ? t(locale, 'menu.fusion.ja') : fusion > 0 ? t(locale, 'menu.fusion.mx') : t(locale, 'menu.fusion.both');

export type MenuFilter = 'all' | 'signature' | 'spicy' | 'vegetarian' | 'seafood' | 'kids' | 'firstTimer';

export const FILTERS: MenuFilter[] = ['all', 'signature', 'spicy', 'vegetarian', 'seafood', 'kids', 'firstTimer'];

export function matches(item: MenuItem, filter: MenuFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'spicy':
      return item.heat >= 3;
    case 'vegetarian':
      return item.tags.includes('vegetarian') || item.tags.includes('vegetarian-option');
    case 'firstTimer':
      return item.tags.includes('first-timer');
    default:
      return item.tags.includes(filter);
  }
}
