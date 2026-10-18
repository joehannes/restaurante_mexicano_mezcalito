/**
 * Shapes shared by the pure domain modules, the server and the islands.
 *
 * Money is always an integer number of centavos (RD$1 = 100). Menu prices are
 * whole pesos, but ITBIS and service produce fractions, and summing floats is
 * how a till ends up a centavo off from the receipt.
 */

export type Locale = 'en' | 'es' | 'fr' | 'de';
export const LOCALES: readonly Locale[] = ['en', 'es', 'fr', 'de'];

/** Text that exists in every launch language. English is the fallback. */
export type Localized = { en: string } & Partial<Record<Exclude<Locale, 'en'>, string>>;

export const localized = (text: Localized, locale: Locale): string => text[locale] ?? text.en;

export type Centavos = number;

export type OrderMode = 'pickup' | 'delivery' | 'dine_in';

export interface ModifierOption {
  id: string;
  label: Localized;
  price: Centavos;
  soldOut?: boolean;
}

export interface ModifierGroup {
  id: string;
  label: Localized;
  /** Fewest options a guest must pick (1 makes the group required). */
  min: number;
  /** Most options a guest may pick. */
  max: number;
  options: ModifierOption[];
}

export interface Variant {
  id: string;
  label: Localized;
  price: Centavos;
  soldOut?: boolean;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: Localized;
  description?: Localized;
  /** Base price, or the price per pound when `unit` is `lb`. Ignored when variants exist. */
  price: Centavos;
  unit: 'each' | 'lb';
  variants?: Variant[];
  modifierGroups?: ModifierGroup[];
  /** 0 (none) … 5 (scotch bonnet). */
  heat: number;
  /** −2 all Jamaica … 0 true fusion … +2 all Mexico. */
  fusion: number;
  tags: string[];
  photo?: string;
  soldOut: boolean;
  /** Hidden from guests altogether, e.g. a seasonal item out of season. */
  hidden: boolean;
}

export interface CartLine {
  itemId: string;
  variantId?: string;
  qty: number;
  /** Pounds, for items sold by weight. */
  weightLb?: number;
  /** Chosen option ids, by modifier group id. */
  options?: Record<string, string[]>;
  note?: string;
}

export interface PricingSettings {
  /** ITBIS, as a fraction (0.18). */
  itbisRate: number;
  /** The legal 10% service charge, per order mode. */
  serviceRate: Record<OrderMode, number>;
  /** Pesos per US dollar, for the guest's estimate only. */
  usdRate: number;
  /** Smallest weight step for items sold by the pound. */
  weightStepLb: number;
  minWeightLb: number;
  maxQtyPerLine: number;
}

export interface DeliveryZone {
  id: string;
  name: string;
  /** [lng, lat] pairs, closed or open ring. */
  polygon: [number, number][];
  fee: Centavos;
  minOrder: Centavos;
}

/** "HH:MM" in Bávaro local time. "24:00" means midnight at the end of the day. */
export type ClockTime = string;

export interface TimeRange {
  open: ClockTime;
  close: ClockTime;
}

/** Index 0 is Sunday, as in `Date#getDay`. */
export type WeeklyHours = TimeRange[][];

export interface Closure {
  /** YYYY-MM-DD, local. */
  date: string;
  /** Replaces the usual hours that day; empty means closed all day. */
  ranges: TimeRange[];
  reason?: string;
}

export interface Special {
  id: string;
  title: Localized;
  /** Weekdays it runs, 0 = Sunday. Empty means every day. */
  days: number[];
  start: ClockTime;
  end: ClockTime;
  /** YYYY-MM-DD bounds, inclusive. */
  validFrom?: string;
  validTo?: string;
  active: boolean;
}

export interface Season {
  slug: string;
  /** YYYY-MM-DD, inclusive, local. */
  startsOn: string;
  endsOn: string;
  priority: number;
  published: boolean;
}
