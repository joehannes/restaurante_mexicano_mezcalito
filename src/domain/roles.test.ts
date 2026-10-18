import { describe, expect, it } from 'vitest';
import { can, isRole } from './roles';

describe('can', () => {
  it('keeps the kitchen to the board and sold-out switches', () => {
    expect(can('kitchen', 'orders')).toBe(true);
    expect(can('kitchen', 'soldout')).toBe(true);
    expect(can('kitchen', 'menu')).toBe(false);
    expect(can('kitchen', 'settings')).toBe(false);
  });
  it('lets managers run everything but staff access', () => {
    expect(can('manager', 'menu')).toBe(true);
    expect(can('manager', 'settings')).toBe(true);
    expect(can('manager', 'staff')).toBe(false);
  });
  it('lets the owner do everything', () => {
    expect(can('owner', 'staff')).toBe(true);
  });
});

describe('isRole', () => {
  it('accepts only known roles', () => {
    expect(isRole('kitchen')).toBe(true);
    expect(isRole('admin')).toBe(false);
  });
});
