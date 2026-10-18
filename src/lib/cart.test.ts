import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});
vi.stubGlobal('window', { addEventListener: () => {} });

const cart = await import('./cart');

describe('cart', () => {
  beforeEach(() => cart.clearCart());

  it('merges identical dishes with identical choices, whatever the option order', () => {
    cart.addToCart({ itemId: 'nachos', qty: 1, options: { protein: ['shrimp', 'chicken'] } });
    cart.addToCart({ itemId: 'nachos', qty: 2, options: { protein: ['chicken', 'shrimp'] } });
    cart.addToCart({ itemId: 'nachos', qty: 1 });
    expect(cart.getCart().map((l) => l.qty)).toEqual([3, 1]);
    expect(cart.cartCount()).toBe(4);
  });

  it('keeps different notes and weights apart', () => {
    cart.addToCart({ itemId: 'lobster', qty: 1, weightLb: 1 });
    cart.addToCart({ itemId: 'lobster', qty: 1, weightLb: 1.5 });
    cart.addToCart({ itemId: 'oxtail', qty: 1, note: 'extra gravy' });
    cart.addToCart({ itemId: 'oxtail', qty: 1 });
    expect(cart.getCart()).toHaveLength(4);
  });

  it('persists, updates quantities and removes at zero', () => {
    cart.addToCart({ itemId: 'oxtail', qty: 1 });
    const [line] = cart.getCart();
    cart.setQty(line!.key, 3);
    expect(JSON.parse(store.get('mezcalito.cart.v1')!)[0].qty).toBe(3);
    cart.setQty(line!.key, 0);
    expect(cart.getCart()).toEqual([]);
  });

  it('tells subscribers about every change', () => {
    const seen: number[] = [];
    const stop = cart.subscribe(() => seen.push(cart.cartCount()));
    cart.addToCart({ itemId: 'oxtail', qty: 2 });
    cart.clearCart();
    stop();
    cart.addToCart({ itemId: 'oxtail', qty: 1 });
    expect(seen).toEqual([2, 0]);
  });
});
