/**
 * The menu, which is also the order page.
 *
 * Server-rendered in full (every dish is in the HTML for search engines and
 * for the first paint), then hydrated for the sheet, search and filters. A
 * dish with nothing to choose gets a one-tap "+"; anything with choices opens
 * the sheet. `?item=<id>` opens that dish straight away — the home page's
 * signature singles link there.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Locale, MenuItem, PricingSettings } from '../domain/types';
import { localized } from '../domain/types';
import { fill, type Dictionary } from '../i18n/fill';
import { addToCart } from '../lib/cart';
import { formatPrice } from '../lib/format';
import { FILTERS, fromPrice, fusionLabel, hasChoices, matches, photoThumb, type MenuFilter } from '../lib/menuView';
import type { Category } from '../server/menu';
import CartPill from './CartPill';
import ItemSheet from './ItemSheet';

interface Props {
  locale: Locale;
  dict: Dictionary;
  categories: Category[];
  menu: MenuItem[];
  pricing: PricingSettings;
  checkoutHref: string;
}

const FILTER_KEY = {
  all: 'menu.filter.all',
  signature: 'menu.filter.signature',
  spicy: 'menu.filter.spicy',
  vegetarian: 'menu.filter.vegetarian',
  seafood: 'menu.filter.seafood',
  kids: 'menu.filter.kids',
  firstTimer: 'menu.filter.firstTimer',
} as const;

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export default function MenuBoard({ locale, dict, categories, menu, pricing, checkoutHref }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MenuFilter>('all');
  const [open, setOpen] = useState<MenuItem | undefined>();

  useEffect(() => {
    const id = new URLSearchParams(location.search).get('item');
    const item = id ? menu.find((i) => i.id === id && !i.soldOut) : undefined;
    if (item) setOpen(item);
  }, [menu]);

  const visible = useMemo(() => {
    const q = fold(query.trim());
    return menu.filter(
      (item) =>
        matches(item, filter) &&
        (!q ||
          fold(localized(item.name, locale)).includes(q) ||
          fold(item.description ? localized(item.description, locale) : '').includes(q)),
    );
  }, [menu, filter, query, locale]);

  const sections = categories
    .map((c) => ({ ...c, items: visible.filter((i) => i.categoryId === c.id) }))
    .filter((c) => c.items.length);

  const quickAdd = (item: MenuItem) => {
    addToCart({ itemId: item.id, qty: 1 });
    navigator.vibrate?.(12);
  };

  return (
    <div>
      <div className="sticky top-14 z-20 border-b border-ink/10 bg-cream">
        <div className="mx-auto max-w-6xl px-4 pt-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={dict['menu.search']}
            aria-label={dict['menu.search']}
            className="w-full rounded-full border-2 border-ink/15 bg-white px-4 py-2"
          />
        </div>
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3" role="group" aria-label="Filters">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full border-2 px-3 py-1 text-sm font-semibold ${
                filter === f ? 'border-ink bg-ink text-cream' : 'border-ink/20'
              }`}
            >
              {dict[FILTER_KEY[f]]}
            </button>
          ))}
        </div>
        <nav className="mx-auto flex max-w-6xl gap-4 overflow-x-auto px-4 pb-2 text-sm font-bold" aria-label={dict['menu.title']}>
          {sections.map((c) => (
            <a key={c.id} href={`#${c.id}`} className="shrink-0 py-1 whitespace-nowrap hover:text-hibiscus">
              {localized(c.name, locale)}
            </a>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-40">
        {!sections.length && <p className="py-16 text-center">{dict['menu.noResults']}</p>}
        {sections.map((c) => (
          <section key={c.id} id={c.id} className="scroll-mt-48 pt-10" aria-labelledby={`h-${c.id}`}>
            <h2 id={`h-${c.id}`} className="font-display text-3xl uppercase">
              {localized(c.name, locale)}
            </h2>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {c.items.map((item) => (
                <li key={item.id} className="relative">
                  <button
                    type="button"
                    disabled={item.soldOut}
                    onClick={() => setOpen(item)}
                    className="flex h-full w-full gap-4 rounded-2xl border-2 border-ink/10 bg-white p-4 pr-16 text-left hover:border-ink disabled:opacity-50"
                  >
                    {item.photo && (
                      <img src={photoThumb(item.photo)} alt="" width={96} height={96} loading="lazy" decoding="async" className="size-24 shrink-0 rounded-xl object-cover" />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold">{localized(item.name, locale)}</span>
                        {item.tags.includes('signature') && (
                          <span className="sticker bg-gold px-2 text-xs" style={{ ['--tilt' as string]: '-3deg' }}>
                            {dict['menu.signature']}
                          </span>
                        )}
                        {item.soldOut && <span className="sticker bg-sunset px-2 text-xs text-cream">{dict['menu.soldOut']}</span>}
                      </span>
                      {item.description && <span className="mt-1 line-clamp-2 text-sm text-ink/75">{localized(item.description, locale)}</span>}
                      <span className="mt-auto flex items-center gap-3 pt-3 text-sm">
                        <span className="font-bold">
                          {item.variants?.length ? `${dict['menu.from']} ` : ''}
                          {formatPrice(fromPrice(item), locale)}
                          {item.unit === 'lb' && ` ${dict['menu.perLb']}`}
                        </span>
                        <span className="text-ink/60">{fusionLabel(item.fusion, dict)}</span>
                        {item.heat >= 3 && (
                          <span className="font-bold text-sunset" aria-label={fill(dict, 'menu.heatLevel', { n: item.heat })}>
                            {'●'.repeat(item.heat)}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                  {!item.soldOut && (
                    <button
                      type="button"
                      onClick={() => (hasChoices(item) ? setOpen(item) : quickAdd(item))}
                      aria-label={`${dict['menu.add']} — ${localized(item.name, locale)}`}
                      className="absolute top-4 right-4 size-10 rounded-full bg-hibiscus text-2xl leading-none font-bold text-cream shadow-[2px_2px_0_var(--c-ink)] active:scale-95"
                    >
                      +
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {open && <ItemSheet key={open.id} item={open} locale={locale} dict={dict} pricing={pricing} onClose={() => setOpen(undefined)} />}
      <CartPill locale={locale} dict={dict} menu={menu} pricing={pricing} checkoutHref={checkoutHref} />
    </div>
  );
}
