import { describe, expect, it } from 'vitest';
import { canMove, nextStatus } from './orderStatus';

describe('nextStatus', () => {
  it('sends delivery on the road and everything else to the pass', () => {
    expect(nextStatus('delivery', 'preparing')).toBe('on_the_way');
    expect(nextStatus('pickup', 'preparing')).toBe('ready');
    expect(nextStatus('dine_in', 'ready')).toBe('done');
    expect(nextStatus('pickup', 'done')).toBeUndefined();
    expect(nextStatus('pickup', 'awaiting_payment')).toBeUndefined();
  });
});

describe('canMove', () => {
  it('allows the next step and one step back', () => {
    expect(canMove('pickup', 'received', 'preparing')).toBe(true);
    expect(canMove('pickup', 'preparing', 'received')).toBe(true);
    expect(canMove('pickup', 'received', 'done')).toBe(false);
    expect(canMove('pickup', 'preparing', 'on_the_way')).toBe(false);
  });
  it('cancels only open orders', () => {
    expect(canMove('delivery', 'on_the_way', 'cancelled')).toBe(true);
    expect(canMove('delivery', 'done', 'cancelled')).toBe(false);
  });
});
