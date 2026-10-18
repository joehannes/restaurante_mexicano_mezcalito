/**
 * The floating "View order" pill: count and food subtotal, one tap to
 * checkout. It bounces (transform only) whenever something lands in it.
 */
import { useEffect, useRef, useState } from 'react';
import { priceCart } from '../domain/pricing';
import type { Locale, MenuItem, PricingSettings } from '../domain/types';
import { fill, type Dictionary } from '../i18n/fill';
import { cartCount } from '../lib/cart';
import { formatPrice } from '../lib/format';
import { useCart } from './useCart';

interface Props {
  locale: Locale;
  dict: Dictionary;
  menu: MenuItem[];
  pricing: PricingSettings;
  checkoutHref: string;
}

export default function CartPill({ locale, dict, menu, pricing, checkoutHref }: Props) {
  const cart = useCart();
  const count = cartCount(cart);
  const subtotal = cart.reduce((sum, line) => {
    const priced = priceCart(menu, [line], pricing, 'pickup');
    return sum + (priced.ok ? priced.subtotal : 0);
  }, 0);

  const previous = useRef(count);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (count > previous.current) setBump((b) => b + 1);
    previous.current = count;
  }, [count]);

  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 md:bottom-6">
      <a
        key={bump}
        href={checkoutHref}
        className="pointer-events-auto flex w-full max-w-md items-center justify-between rounded-full bg-ink px-6 py-4 font-bold text-cream shadow-[4px_4px_0_var(--c-hibiscus)] motion-safe:animate-[bounce-in_380ms_ease-out]"
      >
        <span>{fill(dict, 'cart.view', { count })}</span>
        <span>{formatPrice(subtotal, locale)}</span>
      </a>
    </div>
  );
}
