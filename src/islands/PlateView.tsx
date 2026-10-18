/**
 * Three picks and a drink, as The Selector or the Radio served them: each
 * with why, its price, and a one-tap add. Dishes that need a choice (a side,
 * a size) go to the menu's dish sheet instead of guessing for the guest.
 */
import { useState } from 'react';
import { priceCart } from '../domain/pricing';
import { localized, type CartLine, type Locale, type MenuItem, type PricingSettings } from '../domain/types';
import type { Dictionary } from '../i18n/fill';
import { addToCart } from '../lib/cart';
import { formatPrice } from '../lib/format';

export interface ServedPlate {
  picks: { id: string; why: string }[];
  drink?: { id: string; why: string };
  note?: string;
}

/** A line for the dish with nothing left to choose, or undefined if the guest must choose. */
function readyLine(item: MenuItem, pricing: PricingSettings): CartLine | undefined {
  if (item.unit === 'lb' || (item.variants?.length ?? 0) > 1 || item.modifierGroups?.some((g) => g.min > 0)) return undefined;
  const line: CartLine = { itemId: item.id, qty: 1, variantId: item.variants?.[0]?.id };
  return priceCart([item], [line], pricing, 'pickup').ok ? line : undefined;
}

export default function PlateView({
  plate,
  menu,
  pricing,
  locale,
  dict,
  menuHref,
  checkoutHref,
}: {
  plate: ServedPlate;
  menu: MenuItem[];
  pricing: PricingSettings;
  locale: Locale;
  dict: Dictionary;
  menuHref: string;
  checkoutHref: string;
}) {
  const [added, setAdded] = useState<Set<string>>(new Set());
  const byId = new Map(menu.map((i) => [i.id, i]));
  const rows = [...plate.picks, ...(plate.drink ? [plate.drink] : [])].map((p) => ({ ...p, item: byId.get(p.id) })).filter((r) => r.item);
  const add = (ids: string[]) => {
    for (const id of ids) {
      const line = readyLine(byId.get(id)!, pricing);
      if (line) addToCart(line);
    }
    setAdded((s) => new Set([...s, ...ids]));
  };
  const addable = rows.filter((r) => readyLine(r.item!, pricing)).map((r) => r.id);
  const price = (item: MenuItem) => {
    const variants = item.variants?.filter((v) => !v.soldOut);
    return variants?.length ? Math.min(...variants.map((v) => v.price)) : item.price;
  };

  return (
    <div>
      <ol className="grid gap-4 md:grid-cols-2">
        {rows.map((r, i) => {
          const item = r.item!;
          const ready = addable.includes(r.id);
          const isDrink = item.categoryId === 'drinks';
          return (
            <li key={r.id} className={`flex flex-col justify-between rounded-2xl p-4 shadow-[4px_4px_0_var(--c-ink)] ${isDrink ? 'bg-lagoon' : ['bg-gold', 'bg-cream', 'bg-white'][i % 3]}`}>
              <div>
                <p className="text-xs font-bold tracking-[0.18em] uppercase opacity-70">{isDrink ? dict['selector.drink'] : `${i + 1}`}</p>
                <h3 className="font-display text-3xl leading-none uppercase">{localized(item.name, locale)}</h3>
                {r.why && <p className="mt-2 font-semibold">{r.why}</p>}
              </div>
              <p className="mt-4 flex items-center justify-between gap-3">
                <span className="font-bold">{formatPrice(price(item), locale)}</span>
                {added.has(r.id) && ready ? (
                  <span className="font-bold">✓</span>
                ) : ready ? (
                  <button type="button" onClick={() => add([r.id])} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-cream">
                    {dict['menu.add']}
                  </button>
                ) : (
                  <a href={`${menuHref}?item=${r.id}`} className="rounded-full border-2 border-ink px-4 py-2 text-sm font-bold">
                    {dict['selector.choose']}
                  </a>
                )}
              </p>
            </li>
          );
        })}
      </ol>
      {plate.note && <p className="mt-4 italic">{plate.note}</p>}
      <p className="mt-6 flex flex-wrap items-center gap-3">
        {addable.some((id) => !added.has(id)) && (
          <button type="button" onClick={() => add(addable)} className="cone rounded-full bg-hibiscus px-6 py-3 font-bold text-cream shadow-[4px_4px_0_var(--c-ink)]">
            {dict['selector.addAll']}
          </button>
        )}
        {added.size > 0 && (
          <a href={checkoutHref} className="font-bold underline">
            {dict['selector.added']} →
          </a>
        )}
      </p>
    </div>
  );
}
