import { describe, expect, it } from 'vitest';
import { formatClock, formatPhone, formatPrice, formatUsd } from './format';

describe('formatPrice', () => {
  it('shows whole pesos without decimals and keeps centavos when there are any', () => {
    expect(formatPrice(119_900, 'en')).toBe('RD$1,199');
    expect(formatPrice(119_950, 'en')).toBe('RD$1,199.50');
    expect(formatPrice(119_900, 'es')).toBe('RD$1,199');
    expect(formatPrice(0, 'en')).toBe('RD$0');
  });
  it('uses the locale’s grouping for French and German', () => {
    expect(formatPrice(119_900, 'de')).toBe('RD$1.199');
    expect(formatPrice(119_900, 'fr')).toBe('RD$1 199');
  });
});

describe('formatUsd', () => {
  it('rounds the estimate to whole dollars', () => {
    expect(formatUsd(119_900, 63, 'en')).toBe('≈ US$19');
  });
});

describe('formatClock', () => {
  it('uses 12-hour time in English and 24-hour elsewhere', () => {
    expect(formatClock('00:00', 'en')).toBe('12 am');
    expect(formatClock('24:00', 'en')).toBe('12 am');
    expect(formatClock('17:30', 'en')).toBe('5:30 pm');
    expect(formatClock('12:00', 'en')).toBe('12 pm');
    expect(formatClock('17:30', 'es')).toBe('17:30');
    expect(formatClock('24:00', 'de')).toBe('24:00');
    expect(formatClock('00:30', 'es')).toBe('00:30');
  });
});

describe('formatPhone', () => {
  it('writes North American numbers the way they are dialled here', () => {
    expect(formatPhone('+18099591646')).toBe('+1 809-959-1646');
    expect(formatPhone('+4915112345678')).toBe('+4915112345678');
  });
});
