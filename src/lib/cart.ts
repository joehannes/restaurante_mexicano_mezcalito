/**
 * The guest's cart, kept in localStorage so it survives reloads and the walk
 * from the menu to checkout.
 *
 * Deliberately framework-free: the cart count in the header is a few lines of
 * plain script on every page, while the menu and checkout islands read the
 * same store through `useSyncExternalStore`. Every island on a page imports
 * this one module, so they share one in-memory copy; other tabs are kept in
 * step through the `storage` event.
 *
 * Only ids, choices and quantities are stored — never prices. The server
 * prices the order itself when it is placed.
 */
import type { CartLine } from '../domain/types';

export interface StoredLine extends CartLine {
  /** Identical dishes with identical choices share a key, and so a line. */
  key: string;
}

const STORAGE_KEY = 'mezcalito.cart.v1';
const EMPTY: readonly StoredLine[] = Object.freeze([]);

let lines: readonly StoredLine[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

export function lineKey(line: CartLine): string {
  const options = Object.keys(line.options ?? {})
    .sort()
    .map((group) => `${group}=${[...(line.options?.[group] ?? [])].sort().join('+')}`)
    .join('&');
  return [line.itemId, line.variantId ?? '', line.weightLb ?? '', options, (line.note ?? '').trim()].join('|');
}

function read(): readonly StoredLine[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredLine[]) : [];
    return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.itemId === 'string' && l.qty > 0) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function ensureLoaded() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  lines = read();
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    lines = read();
    listeners.forEach((fn) => fn());
  });
}

function commit(next: readonly StoredLine[]) {
  lines = next;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or a full disk: the cart still works for this page view.
  }
  listeners.forEach((fn) => fn());
}

export function getCart(): readonly StoredLine[] {
  ensureLoaded();
  return lines;
}

/** For server rendering: the cart is always empty there. */
export const getServerCart = () => EMPTY;

export function subscribe(fn: () => void): () => void {
  ensureLoaded();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function addToCart(line: CartLine) {
  const key = lineKey(line);
  const current = getCart();
  const existing = current.find((l) => l.key === key);
  commit(
    existing
      ? current.map((l) => (l.key === key ? { ...l, qty: l.qty + line.qty } : l))
      : [...current, { ...line, note: line.note?.trim() || undefined, key }],
  );
}

export function setQty(key: string, qty: number) {
  commit(qty > 0 ? getCart().map((l) => (l.key === key ? { ...l, qty } : l)) : getCart().filter((l) => l.key !== key));
}

export const removeLine = (key: string) => commit(getCart().filter((l) => l.key !== key));

export const clearCart = () => commit(EMPTY);

export const cartCount = (cart: readonly CartLine[] = getCart()) => cart.reduce((n, l) => n + l.qty, 0);
