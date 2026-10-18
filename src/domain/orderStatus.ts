/** An order's life, and the next step the kitchen can move it to. */
import type { OrderMode } from './types';

export const ORDER_STATUSES = ['awaiting_payment', 'received', 'preparing', 'ready', 'on_the_way', 'done', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const isOrderStatus = (value: unknown): value is OrderStatus => ORDER_STATUSES.includes(value as OrderStatus);

/** Statuses the board still shows; done and cancelled orders drop off. */
export const OPEN_STATUSES: readonly OrderStatus[] = ['awaiting_payment', 'received', 'preparing', 'ready', 'on_the_way'];

/** The one forward step from here, if any. Delivery goes out on the road; the rest wait at the pass. */
export function nextStatus(mode: OrderMode, status: OrderStatus): OrderStatus | undefined {
  switch (status) {
    case 'received':
      return 'preparing';
    case 'preparing':
      return mode === 'delivery' ? 'on_the_way' : 'ready';
    case 'ready':
    case 'on_the_way':
      return 'done';
    default:
      return undefined;
  }
}

/** Staff may step forward, cancel an open order, or undo a step by one. */
export function canMove(mode: OrderMode, from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  if (to === 'cancelled') return OPEN_STATUSES.includes(from);
  if (nextStatus(mode, from) === to) return true;
  return nextStatus(mode, to) === from;
}
