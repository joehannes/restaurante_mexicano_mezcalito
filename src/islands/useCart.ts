import { useSyncExternalStore } from 'react';
import { getCart, getServerCart, subscribe } from '../lib/cart';

/** The cart, re-rendering whenever any island (or another tab) changes it. */
export const useCart = () => useSyncExternalStore(subscribe, getCart, getServerCart);
